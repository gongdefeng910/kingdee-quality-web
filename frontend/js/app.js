/**
 * 金蝶小微官网质量部 - 前端统一脚本 V2.0
 * 处理 index.html 和 admin.html 两个页面的交互逻辑
 */
(function () {
    'use strict';

    // ===== 配置 =====
    var CONFIG = {
        API_BASE: localStorage.getItem('apiBaseUrl') || 'https://kingdee-quality-web-production.up.railway.app',
        get apiUrl() { return this.API_BASE + '/api/v1'; }
    };

    // ===== 工具函数 =====
    var Utils = {
        formatNumber: function (num) {
            if (num === undefined || num === null || num === '--') return '--';
            return Number(num).toLocaleString('zh-CN');
        },

        showToast: function (message, type) {
            type = type || 'success';
            var toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.textContent = message;
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
            setTimeout(function () {
                toast.style.animation = 'toastOut 0.3s ease forwards';
                setTimeout(function () { toast.remove(); }, 300);
            }, 3000);
        },

        $(id) { return document.getElementById(id); },

        show: function (el) { if (el) el.classList.remove('hidden'); },
        hide: function (el) { if (el) el.classList.add('hidden'); }
    };

    // ===== API 客户端 =====
    var API = {
        request: function (method, path, data) {
            var url = CONFIG.apiUrl + path;
            var opts = {
                method: method,
                credentials: 'include',
                headers: {}
            };
            if (data) {
                opts.headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(data);
            }
            return fetch(url, opts).then(function (res) {
                return res.json().then(function (body) {
                    if (res.ok) return body;
                    var err = new Error(body.message || '请求失败');
                    err.code = body.code || res.status;
                    throw err;
                });
            });
        },

        get: function (path)       { return this.request('GET', path); },
        post: function (path, data) { return this.request('POST', path, data); },
        put: function (path, data)  { return this.request('PUT', path, data); },

        // 认证
        login: function (username, password) {
            return this.post('/auth/login', { username: username, password: password });
        },
        logout: function () { return this.post('/auth/logout'); },
        me: function () { return this.get('/auth/me'); },

        // 指标
        getPublicMetrics: function ()  { return this.get('/metrics/public'); },
        getInternalMetrics: function () { return this.get('/metrics/internal'); },
        updatePublicMetrics: function (data) { return this.put('/metrics/public', data); },
        updateInternalMetrics: function (data) { return this.put('/metrics/internal', data); }
    };

    // ===== 认证模块 =====
    var Auth = {
        isLoggedIn: false,
        username: null,
        role: null,

        check: function () {
            var self = this;
            return API.me().then(function (res) {
                self.isLoggedIn = true;
                self.username = res.data.username;
                self.role = res.data.role;
                localStorage.setItem('username', res.data.username);
                return true;
            }).catch(function () {
                self.isLoggedIn = false;
                self.username = null;
                self.role = null;
                localStorage.removeItem('username');
                return false;
            });
        },

        login: function (username, password) {
            var self = this;
            return API.login(username, password).then(function (res) {
                self.isLoggedIn = true;
                self.username = res.data.username;
                self.role = res.data.role;
                localStorage.setItem('username', res.data.username);
                return res;
            });
        },

        logout: function () {
            var self = this;
            return API.logout().catch(function () {}).then(function () {
                self.isLoggedIn = false;
                self.username = null;
                self.role = null;
                localStorage.removeItem('username');
            });
        }
    };

    // ===== 图表模块 =====
    var Charts = {
        trendChart: null,
        internalChart: null,
        adminTrendChart: null,
        adminPieChart: null,

        initTrendChart: function () {
            var ctx = Utils.$('trendChart');
            if (!ctx) return;
            this.trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
                    datasets: [{
                        label: '风险拦截',
                        data: [120, 135, 148, 162, 178, 195],
                        borderColor: '#0066cc',
                        backgroundColor: 'rgba(0, 102, 204, 0.08)',
                        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3
                    }, {
                        label: '版本发布',
                        data: [8, 10, 12, 11, 14, 15],
                        borderColor: '#00b398',
                        backgroundColor: 'rgba(0, 179, 152, 0.08)',
                        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3
                    }]
                },
                options: this._lineOptions()
            });
        },

        initInternalChart: function (data) {
            var ctx = Utils.$('internalChart');
            if (!ctx) return;
            if (this.internalChart) this.internalChart.destroy();
            var total = (data && data.week_cases) || 328;
            this.internalChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['已通过', '执行中', '待执行'],
                    datasets: [{
                        data: [Math.round(total * 0.6), Math.round(total * 0.25), Math.round(total * 0.15)],
                        backgroundColor: ['#00b398', '#0066cc', '#9365ff'],
                        borderWidth: 0
                    }]
                },
                options: this._doughnutOptions()
            });
        },

        initAdminTrend: function () {
            var ctx = Utils.$('adminTrendChart');
            if (!ctx) return;
            this.adminTrendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
                    datasets: [{
                        label: '测试用例数',
                        data: [280, 295, 310, 305, 328, 340],
                        borderColor: '#0066cc',
                        backgroundColor: 'rgba(0, 102, 204, 0.08)',
                        fill: true, tension: 0.4, borderWidth: 2
                    }, {
                        label: '缺陷数',
                        data: [45, 38, 42, 35, 28, 25],
                        borderColor: '#f53f3f',
                        backgroundColor: 'rgba(245, 63, 63, 0.08)',
                        fill: true, tension: 0.4, borderWidth: 2
                    }]
                },
                options: this._lineOptions()
            });
        },

        initAdminPie: function () {
            var ctx = Utils.$('adminPieChart');
            if (!ctx) return;
            this.adminPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['功能缺陷', 'UI问题', '性能问题', '兼容性', '其他'],
                    datasets: [{
                        data: [35, 25, 20, 15, 5],
                        backgroundColor: ['#f53f3f', '#ff7d00', '#0066cc', '#00b398', '#9365ff'],
                        borderWidth: 0
                    }]
                },
                options: this._doughnutOptions()
            });
        },

        _lineOptions: function () {
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#86909c', padding: 16, font: { size: 12 } } }
                },
                scales: {
                    x: { ticks: { color: '#86909c', font: { size: 11 } }, grid: { color: '#f2f3f5' } },
                    y: { ticks: { color: '#86909c', font: { size: 11 } }, grid: { color: '#f2f3f5' } }
                }
            };
        },

        _doughnutOptions: function () {
            return {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#86909c', padding: 14, font: { size: 12 } } }
                }
            };
        }
    };

    // ===== 默认数据 =====
    var DEFAULTS = {
        public: { risk_count: 2156, release_count: 156, performance_boost: 40, error_count: 12 },
        internal: { week_cases: 328, fix_rate: 96.5, auto_rate: 78.3, fix_time: 4.2 }
    };

    // ===================================================================
    //  INDEX PAGE
    // ===================================================================
    var IndexPage = {
        currentVersion: 'external',
        publicData: null,
        internalData: null,

        init: function () {
            var self = this;
            this.bindEvents();
            this.loadPublicData();
            this.initProcessAnimation();

            // 检查登录状态
            Auth.check().then(function (loggedIn) {
                if (loggedIn) {
                    self.onLoginSuccess();
                }
            });
        },

        bindEvents: function () {
            var self = this;

            // 登录弹窗
            var showBtn = Utils.$('showLoginBtn');
            var closeBtn = Utils.$('closeLoginBtn');
            var modal = Utils.$('loginModal');
            var form = Utils.$('loginForm');
            var logoutBtn = Utils.$('logoutBtn');

            if (showBtn) showBtn.addEventListener('click', function () { Utils.show(modal); });
            if (closeBtn) closeBtn.addEventListener('click', function () { Utils.hide(modal); });
            if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) Utils.hide(modal); });

            if (form) {
                form.addEventListener('submit', function (e) {
                    e.preventDefault();
                    self.handleLogin();
                });
            }

            if (logoutBtn) logoutBtn.addEventListener('click', function () { self.handleLogout(); });

            // 版本切换
            document.querySelectorAll('.version-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var version = this.dataset.version;
                    if (version === 'internal' && !Auth.isLoggedIn) {
                        Utils.show(Utils.$('loginModal'));
                        return;
                    }
                    self.switchVersion(version);
                });
            });

            // ESC 关闭弹窗
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') Utils.hide(Utils.$('loginModal'));
            });

            // 密码可见性切换
            var passwordToggle = Utils.$('passwordToggle');
            var passwordInput = Utils.$('loginPassword');
            if (passwordToggle && passwordInput) {
                passwordToggle.addEventListener('click', function () {
                    var isPassword = passwordInput.type === 'password';
                    passwordInput.type = isPassword ? 'text' : 'password';
                    
                    var eyeIcon = passwordToggle.querySelector('.eye-icon');
                    var eyeOffIcon = passwordToggle.querySelector('.eye-off-icon');
                    if (eyeIcon && eyeOffIcon) {
                        if (isPassword) {
                            eyeIcon.classList.add('hidden');
                            eyeOffIcon.classList.remove('hidden');
                            passwordToggle.setAttribute('aria-label', '隐藏密码');
                        } else {
                            eyeIcon.classList.remove('hidden');
                            eyeOffIcon.classList.add('hidden');
                            passwordToggle.setAttribute('aria-label', '显示密码');
                        }
                    }
                });
            }
        },

        handleLogin: function () {
            var username = Utils.$('loginUsername').value.trim();
            var password = Utils.$('loginPassword').value.trim();
            var errorEl = Utils.$('loginError');
            var submitBtn = Utils.$('loginSubmitBtn');

            if (!username || !password) {
                errorEl.textContent = '请输入用户名和密码';
                Utils.show(errorEl);
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '登录中...';
            Utils.hide(errorEl);

            var self = this;
            Auth.login(username, password).then(function () {
                Utils.hide(Utils.$('loginModal'));
                Utils.showToast('登录成功');
                self.onLoginSuccess();
            }).catch(function (err) {
                errorEl.textContent = err.message || '用户名或密码错误';
                Utils.show(errorEl);
            }).finally(function () {
                submitBtn.disabled = false;
                submitBtn.textContent = '登录';
            });
        },

        handleLogout: function () {
            var self = this;
            Auth.logout().then(function () {
                self.onLogout();
                Utils.showToast('已退出登录', 'info');
            });
        },

        onLoginSuccess: function () {
            Utils.hide(Utils.$('loginArea'));
            Utils.show(Utils.$('userInfo'));
            Utils.$('username').textContent = Auth.username || 'admin';

            // 解锁内部面板：隐藏企业介绍，显示内部质量报告
            Utils.hide(Utils.$('panelLocked'));
            Utils.show(Utils.$('panelContent'));
            if (Utils.$('companyIntroPanel')) Utils.hide(Utils.$('companyIntroPanel'));
            if (Utils.$('internalReportPanel')) Utils.show(Utils.$('internalReportPanel'));

            this.loadInternalData();
            
            // 管理员登录后，自动切换到对内版（优先恢复上次选择，否则默认对内版）
            var savedVersion = localStorage.getItem('selectedVersion');
            var targetVersion = savedVersion || 'internal';
            this.switchVersion(targetVersion);
        },

        onLogout: function () {
            Utils.show(Utils.$('loginArea'));
            Utils.hide(Utils.$('userInfo'));
            Utils.hide(Utils.$('panelContent'));
            Utils.show(Utils.$('panelLocked'));
            
            // 退出登录：显示企业介绍，隐藏内部质量报告
            if (Utils.$('companyIntroPanel')) Utils.show(Utils.$('companyIntroPanel'));
            if (Utils.$('internalReportPanel')) Utils.hide(Utils.$('internalReportPanel'));
            
            // 退出登录时清除版本选择记录
            localStorage.removeItem('selectedVersion');
            
            this.switchVersion('external');
        },

        switchVersion: function (version) {
            this.currentVersion = version;
            
            // 如果已登录，保存版本选择到localStorage
            if (Auth.isLoggedIn) {
                localStorage.setItem('selectedVersion', version);
            }
            
            document.querySelectorAll('.version-btn').forEach(function (btn) {
                var isActive = btn.dataset.version === version;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive);
            });

            if (version === 'external') {
                Utils.show(Utils.$('heroDescExternal'));
                Utils.hide(Utils.$('heroDescInternal'));
                Utils.show(Utils.$('heroStatsExternal'));
                Utils.hide(Utils.$('heroStatsInternal'));
                Utils.show(Utils.$('casesExternal'));
                Utils.hide(Utils.$('casesInternal'));
            } else {
                Utils.hide(Utils.$('heroDescExternal'));
                Utils.show(Utils.$('heroDescInternal'));
                Utils.hide(Utils.$('heroStatsExternal'));
                Utils.show(Utils.$('heroStatsInternal'));
                Utils.hide(Utils.$('casesExternal'));
                Utils.show(Utils.$('casesInternal'));
            }
        },

        loadPublicData: function () {
            var self = this;
            API.getPublicMetrics().then(function (res) {
                self.publicData = res.data;
                self.renderPublicData(res.data);
            }).catch(function () {
                self.publicData = DEFAULTS.public;
                self.renderPublicData(DEFAULTS.public);
            });
        },

        renderPublicData: function (d) {
            Utils.$('riskCount').textContent = Utils.formatNumber(d.risk_count);
            Utils.$('releaseCount').textContent = Utils.formatNumber(d.release_count);
            Utils.$('performanceBoost').textContent = d.performance_boost + '%';
            Utils.$('errorCount').textContent = Utils.formatNumber(d.error_count);

            // Hero 对外
            Utils.$('heroRisk').textContent = Utils.formatNumber(d.risk_count) + '+';
            Utils.$('heroRelease').textContent = Utils.formatNumber(d.release_count) + '次';
            Utils.$('heroPerf').textContent = d.performance_boost + '%';
            Utils.$('heroError').textContent = Utils.formatNumber(d.error_count);

            // Hero 对内
            var ir = Utils.$('heroInternalRisk');
            var irl = Utils.$('heroInternalRelease');
            var ip = Utils.$('heroInternalPerf');
            if (ir) ir.textContent = Utils.formatNumber(d.risk_count) + '条';
            if (irl) irl.textContent = Utils.formatNumber(d.release_count) + '次';
            if (ip) ip.textContent = d.performance_boost + '%';

            // 图表
            if (typeof Chart !== 'undefined') Charts.initTrendChart();
        },

        loadInternalData: function () {
            var self = this;
            API.getInternalMetrics().then(function (res) {
                self.internalData = res.data;
                self.renderInternalData(res.data);
            }).catch(function () {
                self.internalData = DEFAULTS.internal;
                self.renderInternalData(DEFAULTS.internal);
            });
        },

        renderInternalData: function (d) {
            Utils.$('weekCases').textContent = Utils.formatNumber(d.week_cases);
            Utils.$('fixRate').textContent = d.fix_rate + '%';
            Utils.$('autoRate').textContent = d.auto_rate + '%';
            Utils.$('fixTime').textContent = d.fix_time + 'h';

            var ci = Utils.$('caseRiskIntercept');
            if (ci && this.publicData) ci.textContent = Utils.formatNumber(this.publicData.risk_count);

            if (typeof Chart !== 'undefined') Charts.initInternalChart(d);
        },

        initProcessAnimation: function () {
            var steps = document.querySelectorAll('.process-step');
            if (!steps.length) return;
            var idx = 0;
            setInterval(function () {
                steps.forEach(function (s, i) {
                    s.classList.toggle('active', i === idx);
                });
                idx = (idx + 1) % steps.length;
            }, 3000);
        }
    };

    // ===================================================================
    //  ADMIN PAGE
    // ===================================================================
    var AdminPage = {
        publicData: {},
        internalData: {},

        init: function () {
            var self = this;
            // 检查登录
            Auth.check().then(function (loggedIn) {
                if (!loggedIn) {
                    alert('请先登录');
                    window.location.href = 'index.html';
                    return;
                }
                Utils.$('username').textContent = Auth.username || 'admin';
                self.loadAllData();
                self.initChartsWhenReady();
                self.bindEvents();
            });
        },

        bindEvents: function () {
            var self = this;

            // 退出
            Utils.$('logoutBtn').addEventListener('click', function () {
                Auth.logout().then(function () {
                    window.location.href = 'index.html';
                });
            });

            // 菜单切换
            document.querySelectorAll('.menu-item').forEach(function (item) {
                item.addEventListener('click', function () {
                    var section = this.dataset.section;
                    self.switchSection(section);
                    document.querySelectorAll('.menu-item').forEach(function (m) {
                        m.classList.remove('active');
                        m.setAttribute('aria-selected', 'false');
                    });
                    this.classList.add('active');
                    this.setAttribute('aria-selected', 'true');
                });
            });

            // 快速编辑
            document.querySelectorAll('.stat-edit').forEach(function (btn) {
                btn.addEventListener('click', function () { self.openEditModal(this.dataset.key); });
                btn.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.openEditModal(this.dataset.key); }
                });
            });

            // 编辑弹窗
            Utils.$('closeEditBtn').addEventListener('click', function () { Utils.hide(Utils.$('editModal')); });
            Utils.$('editModal').addEventListener('click', function (e) { if (e.target === this) Utils.hide(this); });
            Utils.$('editForm').addEventListener('submit', function (e) { e.preventDefault(); self.saveEdit(); });

            // 保存按钮
            Utils.$('savePublicBtn').addEventListener('click', function () { self.savePublicMetrics(); });
            Utils.$('saveInternalBtn').addEventListener('click', function () { self.saveInternalMetrics(); });
            Utils.$('resetPublicBtn').addEventListener('click', function () { self.fillPublicForm(self.publicData); });
            Utils.$('resetInternalBtn').addEventListener('click', function () { self.fillInternalForm(self.internalData); });

            // API 配置
            Utils.$('saveApiBtn').addEventListener('click', function () { self.saveApiUrl(); });

            // 操作日志相关事件
            if (Utils.$('logSearchBtn')) {
                Utils.$('logSearchBtn').addEventListener('click', function () { self.auditLog.search(); });
                Utils.$('logPrevBtn').addEventListener('click', function () { self.auditLog.prevPage(); });
                Utils.$('logNextBtn').addEventListener('click', function () { self.auditLog.nextPage(); });
                Utils.$('logGoBtn').addEventListener('click', function () { self.auditLog.goToPage(); });
                Utils.$('logTimeRange').addEventListener('change', function () {
                    var custom = this.value === 'custom';
                    Utils.$('customDateGroup').style.display = custom ? '' : 'none';
                    Utils.$('customDateEndGroup').style.display = custom ? '' : 'none';
                });
            }

            // ESC 关闭弹窗
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') Utils.hide(Utils.$('editModal'));
            });
        },

        switchSection: function (section) {
            document.querySelectorAll('.content-section').forEach(function (s) { s.classList.remove('active'); });
            var el = Utils.$(section + 'Section');
            if (el) el.classList.add('active');
            if (section === 'auditlog') {
                this.auditLog.render();
            }
        },

        // 操作日志模块
        auditLog: {
            currentPage: 1,
            pageSize: 10,
            filteredData: [],
            mockData: [
                { time: '2025-03-30 14:25:10', operator: 'admin', action: '修改API配置', ip: '192.168.1.100' },
                { time: '2025-03-30 10:15:33', operator: 'admin', action: '登录系统', ip: '192.168.1.101' },
                { time: '2025-03-29 17:42:08', operator: 'admin', action: '修改指标: risk_count = 150', ip: '192.168.1.100' },
                { time: '2025-03-29 16:30:22', operator: 'admin', action: '修改指标: release_count = 28', ip: '192.168.1.100' },
                { time: '2025-03-29 09:05:11', operator: 'admin', action: '登录系统', ip: '10.0.0.55' },
                { time: '2025-03-28 15:18:45', operator: 'admin', action: '修改指标: performance_boost = 35.2', ip: '192.168.1.102' },
                { time: '2025-03-28 11:22:30', operator: 'admin', action: '保存内部指标数据', ip: '192.168.1.100' },
                { time: '2025-03-27 14:55:19', operator: 'admin', action: '登录系统', ip: '192.168.1.101' },
                { time: '2025-03-27 10:08:42', operator: 'admin', action: '修改API配置', ip: '10.0.0.55' },
                { time: '2025-03-26 16:33:57', operator: 'admin', action: '修改指标: error_count = 3', ip: '192.168.1.100' },
                { time: '2025-03-26 09:12:05', operator: 'admin', action: '登录系统', ip: '192.168.1.103' },
                { time: '2025-03-25 15:48:21', operator: 'admin', action: '保存公开指标数据', ip: '192.168.1.100' },
                { time: '2025-03-25 14:30:10', operator: 'admin', action: '修改指标: release_count = 25', ip: '192.168.1.100' },
                { time: '2025-03-24 11:05:33', operator: 'admin', action: '登录系统', ip: '10.0.0.55' },
                { time: '2025-03-23 16:20:44', operator: 'admin', action: '修改API配置', ip: '192.168.1.101' },
                { time: '2025-03-22 09:45:18', operator: 'admin', action: '登录系统', ip: '192.168.1.100' },
                { time: '2025-03-21 14:10:55', operator: 'admin', action: '保存内部指标数据', ip: '192.168.1.102' },
                { time: '2025-03-20 10:30:22', operator: 'admin', action: '登录系统', ip: '10.0.0.55' },
                { time: '2025-03-19 15:55:08', operator: 'admin', action: '修改指标: risk_count = 120', ip: '192.168.1.100' },
                { time: '2025-03-18 09:20:41', operator: 'admin', action: '登录系统', ip: '192.168.1.101' }
            ],
            search: function () {
                var range = Utils.$('logTimeRange').value;
                var operator = Utils.$('logOperator').value.trim().toLowerCase();
                var now = new Date();
                var startDate = null;

                if (range === 'today') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (range === '7days') {
                    startDate = new Date(now.getTime() - 7 * 86400000);
                } else if (range === '30days') {
                    startDate = new Date(now.getTime() - 30 * 86400000);
                } else if (range === 'custom') {
                    var s = Utils.$('logDateStart').value;
                    var e = Utils.$('logDateEnd').value;
                    if (s) startDate = new Date(s);
                    if (e) now = new Date(new Date(e).getTime() + 86400000);
                }

                this.filteredData = this.mockData.filter(function (item) {
                    var itemDate = new Date(item.time);
                    if (startDate && itemDate < startDate) return false;
                    if (range === 'custom' && itemDate > now) return false;
                    if (operator && item.operator.toLowerCase().indexOf(operator) === -1) return false;
                    return true;
                });
                this.currentPage = 1;
                this.render();
            },
            render: function () {
                if (!this.filteredData.length) {
                    this.filteredData = this.mockData.slice();
                }
                var total = this.filteredData.length;
                var totalPages = Math.max(1, Math.ceil(total / this.pageSize));
                if (this.currentPage > totalPages) this.currentPage = totalPages;
                var start = (this.currentPage - 1) * this.pageSize;
                var pageData = this.filteredData.slice(start, start + this.pageSize);

                var tbody = Utils.$('logTableBody');
                var html = '';
                if (pageData.length === 0) {
                    html = '<tr><td colspan="4" style="padding:24px 16px;text-align:center;color:var(--text-secondary);">暂无数据</td></tr>';
                } else {
                    pageData.forEach(function (item) {
                        html += '<tr style="border-bottom:1px solid var(--border-light);cursor:default;" onmouseover="this.style.background=\'var(--primary-light)\'" onmouseout="this.style.background=\'\'">';
                        html += '<td style="padding:10px 16px;color:var(--text-primary);">' + item.time + '</td>';
                        html += '<td style="padding:10px 16px;color:var(--text-primary);">' + item.operator + '</td>';
                        html += '<td style="padding:10px 16px;color:var(--text-primary);">' + item.action + '</td>';
                        html += '<td style="padding:10px 16px;color:var(--text-secondary);">' + item.ip + '</td>';
                        html += '</tr>';
                    });
                }
                tbody.innerHTML = html;

                Utils.$('logPageInfo').textContent = '共 ' + total + ' 条记录';
                Utils.$('logPageNum').textContent = this.currentPage + ' / ' + totalPages;
                Utils.$('logPrevBtn').disabled = this.currentPage <= 1;
                Utils.$('logNextBtn').disabled = this.currentPage >= totalPages;
                Utils.$('logGoPage').max = totalPages;
            },
            prevPage: function () {
                if (this.currentPage > 1) { this.currentPage--; this.render(); }
            },
            nextPage: function () {
                var totalPages = Math.ceil(this.filteredData.length / this.pageSize);
                if (this.currentPage < totalPages) { this.currentPage++; this.render(); }
            },
            goToPage: function () {
                var page = parseInt(Utils.$('logGoPage').value, 10);
                var totalPages = Math.ceil(this.filteredData.length / this.pageSize);
                if (page >= 1 && page <= totalPages) { this.currentPage = page; this.render(); }
            }
        },

        loadAllData: function () {
            var self = this;
            API.getPublicMetrics().then(function (res) {
                self.publicData = res.data;
                self.renderDashboard(res.data);
                self.fillPublicForm(res.data);
            }).catch(function () {
                self.publicData = DEFAULTS.public;
                self.renderDashboard(DEFAULTS.public);
                self.fillPublicForm(DEFAULTS.public);
            });

            API.getInternalMetrics().then(function (res) {
                self.internalData = res.data;
                self.fillInternalForm(res.data);
            }).catch(function () {
                self.internalData = DEFAULTS.internal;
                self.fillInternalForm(DEFAULTS.internal);
            });
        },

        renderDashboard: function (d) {
            Utils.$('adminRiskCount').textContent = Utils.formatNumber(d.risk_count);
            Utils.$('adminReleaseCount').textContent = Utils.formatNumber(d.release_count);
            Utils.$('adminPerformanceBoost').textContent = d.performance_boost + '%';
            Utils.$('adminErrorCount').textContent = Utils.formatNumber(d.error_count);
        },

        fillPublicForm: function (d) {
            Utils.$('editRiskCount').value = d.risk_count || '';
            Utils.$('editReleaseCount').value = d.release_count || '';
            Utils.$('editPerformanceBoost').value = d.performance_boost || '';
            Utils.$('editErrorCount').value = d.error_count || '';
        },

        fillInternalForm: function (d) {
            Utils.$('editWeekCases').value = d.week_cases || '';
            Utils.$('editFixRate').value = d.fix_rate || '';
            Utils.$('editAutoRate').value = d.auto_rate || '';
            Utils.$('editFixTime').value = d.fix_time || '';
        },

        savePublicMetrics: function () {
            var self = this;
            var data = {
                risk_count: parseInt(Utils.$('editRiskCount').value) || 0,
                release_count: parseInt(Utils.$('editReleaseCount').value) || 0,
                performance_boost: parseFloat(Utils.$('editPerformanceBoost').value) || 0,
                error_count: parseInt(Utils.$('editErrorCount').value) || 0
            };

            API.updatePublicMetrics(data).then(function () {
                self.publicData = data;
                self.renderDashboard(data);
                Utils.showToast('核心指标保存成功');
            }).catch(function (err) {
                Utils.showToast(err.message || '保存失败', 'error');
            });
        },

        saveInternalMetrics: function () {
            var self = this;
            var data = {
                week_cases: parseInt(Utils.$('editWeekCases').value) || 0,
                fix_rate: parseFloat(Utils.$('editFixRate').value) || 0,
                auto_rate: parseFloat(Utils.$('editAutoRate').value) || 0,
                fix_time: parseFloat(Utils.$('editFixTime').value) || 0
            };

            API.updateInternalMetrics(data).then(function () {
                self.internalData = data;
                Utils.showToast('内部指标保存成功');
            }).catch(function (err) {
                Utils.showToast(err.message || '保存失败', 'error');
            });
        },

        openEditModal: function (key) {
            var labels = {
                risk_count: '拦截风险内容',
                release_count: '版本发布次数',
                performance_boost: '页面性能提升 (%)',
                error_count: '重大内容错误'
            };
            Utils.$('editLabel').textContent = labels[key] || key;
            Utils.$('editValue').value = this.publicData[key] || '';
            Utils.$('editKey').value = key;
            Utils.show(Utils.$('editModal'));
            Utils.$('editValue').focus();
        },

        saveEdit: function () {
            var key = Utils.$('editKey').value;
            var value = parseFloat(Utils.$('editValue').value) || 0;
            var data = {};
            data[key] = value;

            var self = this;
            API.updatePublicMetrics(data).then(function () {
                self.publicData[key] = value;
                self.renderDashboard(self.publicData);
                self.fillPublicForm(self.publicData);
                Utils.hide(Utils.$('editModal'));
                Utils.showToast('保存成功');
            }).catch(function (err) {
                Utils.showToast(err.message || '保存失败', 'error');
            });
        },

        saveApiUrl: function () {
            var url = Utils.$('apiBaseUrl').value.trim();
            if (!url) {
                Utils.showToast('请输入有效的 API 地址', 'error');
                return;
            }
            localStorage.setItem('apiBaseUrl', url);
            CONFIG.API_BASE = url;
            Utils.showToast('API 地址已保存，刷新页面后生效', 'info');
        },

        initChartsWhenReady: function () {
            var self = this;
            function tryInit() {
                if (typeof Chart !== 'undefined') {
                    Charts.initAdminTrend();
                    Charts.initAdminPie();
                } else {
                    setTimeout(tryInit, 200);
                }
            }
            tryInit();
        }
    };

    // ===== 加载已保存的 API 地址 =====
    (function () {
        var saved = localStorage.getItem('apiBaseUrl');
        if (saved) {
            CONFIG.API_BASE = saved;
            var input = Utils.$('apiBaseUrl');
            if (input) input.value = saved;
        }
    })();

    // ===== 页面初始化 =====
    document.addEventListener('DOMContentLoaded', function () {
        var page = document.body.dataset.page;
        if (page === 'index') {
            IndexPage.init();
        } else if (page === 'admin') {
            AdminPage.init();
        }
    });

})();
