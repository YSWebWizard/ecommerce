ReactionCore.registerPackage({
  label: "Accounts",
  name: "reaction-accounts",
  icon: "fa fa-sign-in",
  autoEnable: true,
  settings: {},
  registry: [{
    route: "/dashboard/accounts",
    name: "accounts",
    provides: "dashboard",
    label: "Accounts",
    description: "Manage how members sign into your shop.",
    icon: "fa fa-sign-in",
    container: "core",
    template: "accountsDashboard",
    workflow: "coreAccountsWorkflow",
    priority: 1
  }, {
    label: "Account Settings",
    provides: "settings",
    container: "accounts",
    template: "accountsSettings"
  }, {
    route: "/dashboard/accounts",
    provides: "shortcut",
    label: "Accounts",
    icon: "fa fa-users",
    priority: 1
  }, {
    route: "/account/profile",
    template: "accountProfile",
    label: "Profile",
    icon: "fa fa-user",
    provides: "userAccountDropdown"
  }],
  layout: [{
    layout: "coreLayout",
    workflow: "coreAccountsWorkflow",
    collection: "Accounts",
    theme: "default",
    enabled: true,
    structure: {
      template: "accountsDashboard",
      layoutHeader: "layoutHeader",
      layoutFooter: "",
      notFound: "notFound",
      dashboardHeader: "dashboardHeader",
      dashboardControls: "accountsDashboardControls",
      dashboardHeaderControls: "",
      adminControlsFooter: "adminControlsFooter"
    }
  }]
});
