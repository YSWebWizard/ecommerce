ReactionCore.registerPackage({
  label: "Accounts",
  name: "reaction-accounts",
  icon: "fa fa-sign-in",
  autoEnable: true,
  registry: [
    {
      route: "dashboard/accounts",
      provides: "dashboard",
      label: "Accounts",
      description: "Manage how members sign into your shop.",
      i18nKeyLabel: "admin.dashboard.accountsLabel",
      i18nKeyDescription: "admin.dashboard.accountsDescription",
      icon: "fa fa-sign-in",
      cycle: 1,
      container: "accounts"
    },
    {
      label: "Account Settings",
      i18nKeyLabel: "admin.settings.account",
      route: "dashboard/accounts",
      provides: "settings",
      container: "accounts",
      template: "accountsSettings"
    },
    {
      route: "dashboard/accounts",
      provides: "shortcut",
      label: "Accounts",
      i18nKeyLabel: "admin.shortcuts.accounts",
      icon: "fa fa-users",
      cycle: 1
    },
    {
      route: "account/profile",
      label: "Profile",
      icon: "fa fa-user",
      provides: "userAccountDropdown"
    }
  ],
  permissions: [
    {
      label: "Accounts",
      permission: "dashboard/accounts",
      group: "Shop Settings"
    }
  ]
});
