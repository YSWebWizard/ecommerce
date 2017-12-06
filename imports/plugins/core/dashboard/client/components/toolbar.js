import React, { Component } from "react";
import PropTypes from "prop-types";
import Blaze from "meteor/gadicc:blaze-react-component";
import { Components } from "@reactioncommerce/reaction-components";
import {
  DropDownMenu,
  MenuItem,
  FlatButton,
  Switch,
  Icon,
  VerticalDivider
} from "/imports/plugins/core/ui/client/components";
import { Translatable } from "/imports/plugins/core/ui/client/providers";
import { Reaction } from "/client/api";

class PublishControls extends Component {
  static propTypes = {
    dashboardHeaderTemplate: PropTypes.oneOfType([PropTypes.func, PropTypes.node, PropTypes.string]),
    documentIds: PropTypes.arrayOf(PropTypes.string),
    documents: PropTypes.arrayOf(PropTypes.object),
    hasCreateProductAccess: PropTypes.bool,
    isEnabled: PropTypes.bool,
    isPreview: PropTypes.bool,
    onAddProduct: PropTypes.func,
    onShopSelectChange: PropTypes.func,
    onViewContextChange: PropTypes.func,
    onVisibilityChange: PropTypes.func,
    packageButtons: PropTypes.arrayOf(PropTypes.object),
    shopId: PropTypes.string,
    shops: PropTypes.arrayOf(PropTypes.object),
    showViewAsControls: PropTypes.bool,
    translation: PropTypes.shape({
      lang: PropTypes.string
    })
  }

  static defaultProps = {
    showViewAsControls: true
  }

  onViewContextChange = (event, isChecked) => {
    if (typeof this.props.onViewContextChange === "function") {
      this.props.onViewContextChange(event, isChecked ? "administrator" : "customer");
    }
  }

  // Passthrough to shopSelectChange handler in container above
  onShopSelectChange = (event, shopId) => {
    if (typeof this.props.onShopSelectChange === "function") {
      this.props.onShopSelectChange(event, shopId);
    }
  }

  renderViewControls() {
    if (this.props.showViewAsControls) {
      return (
        <FlatButton
          label="Private"
          i18nKeyLabel="app.private"
          i18nKeyToggleOnLabel="app.public"
          toggleOnLabel="Public"
          icon="fa fa-eye-slash"
          onIcon="fa fa-eye"
          toggle={true}
          value="public"
          onValue="private"
          toggleOn={this.isVisible === "public"}
          onToggle={this.handleVisibilityChange}
        />
      );
    }

    return null;
  }

  renderShopSelect() {
    // TODO: If we can change hasShopSwitcherAccess to only be for marketplace owner, use it here instead of new hasMarketplacePermission const
    const hasMarketplacePermission = Reaction.hasAdminAccess(Reaction.getPrimaryShopId());

    let menuItems;

    // If user account has Marketplace permissions, show shop switcher
    if (hasMarketplacePermission === true) { // TODO: see not on line 79 above
      if (Array.isArray(this.props.shops)) {
        menuItems = this.props.shops.map((shop, index) => {
          return (
            <MenuItem
              label={shop.name}
              selectLabel={shop.name}
              value={shop._id}
              key={index}
            />
          );
        });
      }

      return (
        <DropDownMenu
          onChange={this.onShopSelectChange}
          value={this.props.shopId}
          closeOnClick={true}
        >
          {menuItems}
        </DropDownMenu>
      );
    }

    // If the user is just a shop owner, not a marketplace owner,
    // then make sure the shop is set to their shop and show them nothing
    return this.onShopSelectChange(null, Reaction.getSellerShopId());
  }

  renderVisibilitySwitch() {
    if (this.props.hasCreateProductAccess) {
      return (
        <Switch
          i18nKeyLabel="app.editMode"
          i18nKeyOnLabel="app.editMode"
          label={"Edit Mode"}
          onLabel={"Edit Mode"}
          checked={!this.props.isPreview}
          onChange={this.onViewContextChange}
        />
      );
    }

    return null;
  }

  renderAdminButton() {
    return (
      <Components.ToolbarGroup visibleOnMobile={true}>
        <VerticalDivider key={"divder-2"} />
        <FlatButton
          key="dashboard-button"
          onClick={() => {
            Reaction.showActionView({
              i18nKeyTitle: "dashboard.coreTitle",
              title: "Dashboard",
              template: "dashboardPackages"
            });
          }}
        >
          <Icon icon="icon icon-reaction-logo" />
        </FlatButton>
      </Components.ToolbarGroup>
    );
  }

  renderAddButton() {
    if (this.props.hasCreateProductAccess) {
      return (
        <FlatButton
          i18nKeyTooltip="app.shortcut.addProductLabel"
          icon={"fa fa-plus"}
          tooltip={"Add Product"}
          onClick={this.props.onAddProduct}
        />
      );
    }

    return null;
  }

  renderPackageButons() {
    if (Array.isArray(this.props.packageButtons)) {
      return this.props.packageButtons.map((packageButton, index) => {
        return (
          <FlatButton {...packageButton} key={index} />
        );
      });
    }

    return null;
  }

  renderCustomControls() {
    if (this.props.dashboardHeaderTemplate && this.props.hasCreateProductAccess) {
      if (this.props.isEnabled) {
        return [
          <VerticalDivider key="customControlsVerticaldivider" />,
          <Blaze key="customControls" template={this.props.dashboardHeaderTemplate} />
        ];
      }
      return [
        <Blaze key="customControls" template={this.props.dashboardHeaderTemplate} />
      ];
    }

    return null;
  }

  render() {
    return (
      <Components.Toolbar>
        <Components.ToolbarGroup firstChild={true}>
          {this.renderVisibilitySwitch()}
          {this.renderShopSelect()}
        </Components.ToolbarGroup>
        <Components.ToolbarGroup lastChild={true}>
          {this.renderAddButton()}
          {this.renderPackageButons()}
          {this.renderCustomControls()}
        </Components.ToolbarGroup>
        {this.renderAdminButton()}
      </Components.Toolbar>
    );
  }
}

export default Translatable()(PublishControls);
