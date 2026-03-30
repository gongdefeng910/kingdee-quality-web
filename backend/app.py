"""
金蝶小微官网质量部 - 后端 API 服务 V2.0
部署平台: Render
数据库: SQLite（兼容 PostgreSQL 迁移）
认证: JWT + HttpOnly Cookie
"""

import os
import json
import datetime
from functools import wraps

from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
import jwt
import bcrypt

from models import db, User, Metric, AuditLog

load_dotenv()

# ==================== 应用初始化 ====================
app = Flask(__name__)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-fallback-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///quality.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

IS_PRODUCTION = os.environ.get('FLASK_ENV') == 'production'

# 数据库
db.init_app(app)

# CORS 白名单（包含 GitHub Pages 生产地址）
default_origins = [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://gongdefeng910.github.io'
]
env_origins = os.environ.get('ALLOWED_ORIGINS', '')
if env_origins:
    default_origins.extend([o.strip() for o in env_origins.split(',') if o.strip()])
CORS(app, origins=default_origins, supports_credentials=True, allow_headers=['Content-Type', 'Authorization'])

# 速率限制
limiter = Limiter(get_remote_address, app=app, storage_uri="memory://")

# ==================== 指标白名单 ====================
PUBLIC_METRIC_KEYS = {'risk_count', 'release_count', 'performance_boost', 'error_count'}
INTERNAL_METRIC_KEYS = {'week_cases', 'fix_rate', 'auto_rate', 'fix_time'}

# ==================== 安全响应头 ====================
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    if IS_PRODUCTION:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

# ==================== 工具函数 ====================
def api_response(data=None, message='success', code=200):
    """统一响应格式"""
    body = {
        'code': code,
        'message': message,
        'data': data,
        'timestamp': datetime.datetime.utcnow().isoformat() + 'Z'
    }
    return jsonify(body), code

def log_audit(user_id, action, resource=None, details=None):
    """记录审计日志"""
    try:
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource=resource,
            ip_address=request.remote_addr,
            details=json.dumps(details) if details else None
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()

# ==================== 认证装饰器 ====================
def token_required(f):
    """从 HttpOnly Cookie 读取 JWT 并验证"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('access_token')
        if not token:
            return api_response(message='请先登录', code=401)
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.current_user = payload
        except jwt.ExpiredSignatureError:
            return api_response(message='登录已过期，请重新登录', code=401)
        except jwt.InvalidTokenError:
            return api_response(message='无效的认证信息', code=401)
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """管理员权限校验"""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if request.current_user.get('role') != 'admin':
            return api_response(message='权限不足', code=403)
        return f(*args, **kwargs)
    return decorated

# ==================== 数据库初始化 ====================
def init_db():
    """创建表并插入默认数据"""
    db.create_all()

    # 创建默认管理员
    if not User.query.filter_by(username='admin').first():
        hashed = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin = User(username='admin', password_hash=hashed, role='admin')
        db.session.add(admin)

    # 插入默认公开指标
    defaults_public = {
        'risk_count': 2156,
        'release_count': 156,
        'performance_boost': 40,
        'error_count': 12
    }
    for key, value in defaults_public.items():
        if not Metric.query.filter_by(category='public', key=key).first():
            db.session.add(Metric(category='public', key=key, value=value))

    # 插入默认内部指标
    defaults_internal = {
        'week_cases': 328,
        'fix_rate': 96.5,
        'auto_rate': 78.3,
        'fix_time': 4.2
    }
    for key, value in defaults_internal.items():
        if not Metric.query.filter_by(category='internal', key=key).first():
            db.session.add(Metric(category='internal', key=key, value=value))

    db.session.commit()

# ==================== 认证接口 ====================
@app.route('/api/v1/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    """用户登录，签发 JWT 并设置 HttpOnly Cookie"""
    data = request.get_json()
    if not data:
        return api_response(message='请求数据不能为空', code=400)

    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    if not username or not password:
        return api_response(message='用户名和密码不能为空', code=400)

    user = User.query.filter_by(username=username, is_active=True).first()
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        log_audit(None, 'login_failed', details={'username': username})
        return api_response(message='用户名或密码错误', code=401)

    # 签发 JWT
    payload = {
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

    log_audit(user.id, 'login', details={'username': username})

    resp = make_response(api_response(
        data={'username': user.username, 'role': user.role},
        message='登录成功'
    ))

    resp.set_cookie(
        'access_token',
        token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite='None' if IS_PRODUCTION else 'Lax',
        max_age=7200,
        path='/'
    )
    return resp

@app.route('/api/v1/auth/logout', methods=['POST'])
def logout():
    """退出登录，清除 Cookie"""
    resp = make_response(api_response(message='已退出登录'))
    resp.set_cookie(
        'access_token', '',
        httponly=True,
        secure=IS_PRODUCTION,
        samesite='None' if IS_PRODUCTION else 'Lax',
        max_age=0,
        path='/'
    )
    return resp

@app.route('/api/v1/auth/me', methods=['GET'])
@token_required
def auth_me():
    """获取当前登录用户信息"""
    return api_response(data={
        'username': request.current_user.get('username'),
        'role': request.current_user.get('role')
    })

# ==================== 公开指标接口 ====================
@app.route('/api/v1/metrics/public', methods=['GET'])
@limiter.limit("60 per minute")
def get_public_metrics():
    """获取公开指标"""
    rows = Metric.query.filter_by(category='public').all()
    data = {row.key: row.value for row in rows}
    resp = make_response(api_response(data=data))
    resp.headers['Cache-Control'] = 'public, max-age=300'
    return resp

@app.route('/api/v1/metrics/public', methods=['PUT'])
@admin_required
@limiter.limit("10 per minute")
def update_public_metrics():
    """更新公开指标（管理员）"""
    data = request.get_json()
    if not data:
        return api_response(message='请求数据不能为空', code=400)

    updated = {}
    for key, value in data.items():
        if key not in PUBLIC_METRIC_KEYS:
            continue
        try:
            value = float(value)
        except (TypeError, ValueError):
            return api_response(message=f'指标 {key} 的值必须是数字', code=400)

        metric = Metric.query.filter_by(category='public', key=key).first()
        if metric:
            metric.value = value
            metric.updated_by = request.current_user.get('user_id')
        else:
            db.session.add(Metric(
                category='public', key=key, value=value,
                updated_by=request.current_user.get('user_id')
            ))
        updated[key] = value

    if not updated:
        return api_response(message='未提供有效的指标数据', code=400)

    db.session.commit()
    log_audit(request.current_user.get('user_id'), 'update_metrics',
              resource='public', details=updated)
    return api_response(data=updated, message='公开指标更新成功')

# ==================== 内部指标接口 ====================
@app.route('/api/v1/metrics/internal', methods=['GET'])
@token_required
@limiter.limit("30 per minute")
def get_internal_metrics():
    """获取内部指标（需登录）"""
    rows = Metric.query.filter_by(category='internal').all()
    data = {row.key: row.value for row in rows}
    return api_response(data=data)

@app.route('/api/v1/metrics/internal', methods=['PUT'])
@admin_required
@limiter.limit("10 per minute")
def update_internal_metrics():
    """更新内部指标（管理员）"""
    data = request.get_json()
    if not data:
        return api_response(message='请求数据不能为空', code=400)

    updated = {}
    for key, value in data.items():
        if key not in INTERNAL_METRIC_KEYS:
            continue
        try:
            value = float(value)
        except (TypeError, ValueError):
            return api_response(message=f'指标 {key} 的值必须是数字', code=400)

        metric = Metric.query.filter_by(category='internal', key=key).first()
        if metric:
            metric.value = value
            metric.updated_by = request.current_user.get('user_id')
        else:
            db.session.add(Metric(
                category='internal', key=key, value=value,
                updated_by=request.current_user.get('user_id')
            ))
        updated[key] = value

    if not updated:
        return api_response(message='未提供有效的指标数据', code=400)

    db.session.commit()
    log_audit(request.current_user.get('user_id'), 'update_metrics',
              resource='internal', details=updated)
    return api_response(data=updated, message='内部指标更新成功')

# ==================== 健康检查 ====================
@app.route('/api/v1/health', methods=['GET'])
def health_check():
    return api_response(data={
        'status': 'healthy',
        'version': '2.0.0'
    })

@app.route('/')
def index():
    return api_response(data={
        'name': '金蝶小微官网质量部 API',
        'version': '2.0.0',
        'status': 'running'
    })

# ==================== 错误处理 ====================
@app.errorhandler(404)
def not_found(error):
    return api_response(message='接口不存在', code=404)

@app.errorhandler(429)
def rate_limit_exceeded(error):
    return api_response(message='请求过于频繁，请稍后再试', code=429)

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return api_response(message='服务器内部错误', code=500)

# ==================== 初始化数据库（gunicorn 兼容）====================
with app.app_context():
    init_db()

# ==================== 启动 ====================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=not IS_PRODUCTION)
