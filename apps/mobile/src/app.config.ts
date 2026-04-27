export default defineAppConfig({
  pages: [
    // 数组首项即冷启动首页；未登录会在 hydrate 后由各页面自行 reLaunch 到 login。
    'pages/home/index',
    'pages/witness/index',
    'pages/echo/index',
    'pages/me/index',
    'pages/login/index',
    'pages/moments/publish/index',
    'pages/reports/publish/index',
    'pages/posts/detail/index',
    'pages/me/change-password/index',
    'pages/me/edit-profile/index',
    'pages/me/settings/index',
  ],
  // window：nav bar 与页面顶部 warm-sand gradient 对齐
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#C3B59F',
    navigationBarTitleText: 'momoya',
    navigationBarTextStyle: 'black',
    backgroundColor: '#C3B59F',
  },
  // tabBar：使用各端原生 tabBar。想把图标看起来小一点，直接在 PNG 图案外侧留更多透明 padding，
  // 跨端无副作用（weapp / 其它小程序 / Taro H5 均生效）。
  tabBar: {
    color: '#C3B59F',
    selectedColor: '#668F80',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '朝夕', iconPath: 'assets/icons/tabbar/home.png', selectedIconPath: 'assets/icons/tabbar/home-active.png' },
      { pagePath: 'pages/witness/index', text: '见证', iconPath: 'assets/icons/tabbar/witness.png', selectedIconPath: 'assets/icons/tabbar/witness-active.png' },
      { pagePath: 'pages/echo/index', text: '回响', iconPath: 'assets/icons/tabbar/echo.png', selectedIconPath: 'assets/icons/tabbar/echo-active.png' },
      { pagePath: 'pages/me/index', text: '独白', iconPath: 'assets/icons/tabbar/me.png', selectedIconPath: 'assets/icons/tabbar/me-active.png' },
    ],
  },
})
