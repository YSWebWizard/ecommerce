import React, { Component } from "react";
import PropTypes from "prop-types";
import { compose } from "recompose";
import { registerComponent, composeWithTracker } from "@reactioncommerce/reaction-components";
import { Meteor } from "meteor/meteor";
import { ReactiveVar } from "meteor/reactive-var";
import { Session } from "meteor/session";
import { Tracker } from "meteor/tracker";
import { Reaction } from "/client/api";
import { ITEMS_INCREMENT } from "/client/config/defaults";
import { ReactionProduct } from "/lib/api";
import { applyProductRevision } from "/lib/api/products";
import { Catalog, Products, Tags, Shops } from "/lib/collections";
import { Media } from "/imports/plugins/core/files/client";
import ProductsComponent from "../components/customer/productGrid";

const reactiveProductIds = new ReactiveVar([], (oldVal, newVal) => JSON.stringify(oldVal.sort()) === JSON.stringify(newVal.sort()));

// Isolated resubscribe to product grid images, only when the list of product IDs changes
// Tracker.autorun(() => {
//   Meteor.subscribe("ProductGridMedia", reactiveProductIds.get());
// });


/**
 * loadMoreProducts
 * @summary whenever #productScrollLimitLoader becomes visible, retrieve more results
 * this basically runs this:
 * Session.set('productScrollLimit', Session.get('productScrollLimit') + ITEMS_INCREMENT);
 * @return {undefined}
 */
function loadMoreProducts() {
  let threshold;
  const target = document.querySelectorAll("#productScrollLimitLoader");
  let scrollContainer = document.querySelectorAll("#container-main");
  if (scrollContainer.length === 0) {
    scrollContainer = window;
  }

  if (target.length) {
    threshold = scrollContainer[0].scrollHeight - scrollContainer[0].scrollTop === scrollContainer[0].clientHeight;

    if (threshold) {
      if (!target[0].getAttribute("visible")) {
        target[0].setAttribute("productScrollLimit", true);
        Session.set("productScrollLimit", Session.get("productScrollLimit") + ITEMS_INCREMENT || 24);
      }
    } else if (target[0].getAttribute("visible")) {
      target[0].setAttribute("visible", false);
    }
  }
}

const wrapComponent = (Comp) => (
  class ProductsContainer extends Component {
    static propTypes = {
      canLoadMoreProducts: PropTypes.bool,
      productsSubscription: PropTypes.object,
      showNotFound: PropTypes.bool
    };

    constructor(props) {
      super(props);
      this.state = {
        initialLoad: true
      };

      this.ready = this.ready.bind(this);
      this.loadMoreProducts = this.loadMoreProducts.bind(this);
    }

    ready = () => {
      if (this.props.showNotFound === true) {
        return false;
      }

      const isInitialLoad = this.state.initialLoad === true;
      const isReady = this.props.productsSubscription.ready();

      if (isInitialLoad === false) {
        return true;
      }

      if (isReady) {
        return true;
      }

      return false;
    }

    loadMoreProducts = () => this.props.canLoadMoreProducts === true

    loadProducts = (event) => {
      event.preventDefault();
      this.setState({
        initialLoad: false
      });
      loadMoreProducts();
    }

    render() {
      return (
        <Comp
          {...this.props}
          ready={this.ready}
          loadMoreProducts={this.loadMoreProducts}
          loadProducts={this.loadProducts}
        />
      );
    }
  }
);

function composer(props, onData) {
  window.prerenderReady = false;

  let canLoadMoreProducts = false;

  const slug = Reaction.Router.getParam("slug");
  const shopIdOrSlug = Reaction.Router.getParam("shopSlug");

  const tag = Tags.findOne({ slug }) || Tags.findOne(slug);
  const scrollLimit = Session.get("productScrollLimit");
  let tags = {}; // this could be shop default implementation needed
  let shopIds = {};

  if (tag) {
    tags = { tags: [tag._id] };
  }

  if (shopIdOrSlug) {
    shopIds = { shops: [shopIdOrSlug] };
  }

  // if we get an invalid slug, don't return all products
  if (!tag && slug) {
    onData(null, {
      showNotFound: true
    });

    return;
  }

  const currentTag = ReactionProduct.getTag();

  const sort = {
    [`positions.${currentTag}.position`]: 1,
    [`positions.${currentTag}.createdAt`]: 1,
    createdAt: 1
  };

  // TODO: Remove
  // const viewAsPref = Reaction.getUserPreferences("reaction-dashboard", "viewAs");

  // TODO: Remove
  // Edit mode is true by default
  // let editMode = true;

  // TODO: Remove
  // if we have a "viewAs" preference and the preference is not set to "administrator", then edit mode is false
  // if (viewAsPref && viewAsPref !== "administrator") {
  //   editMode = false;
  // }

  const queryParams = Object.assign({}, tags, Reaction.Router.current().query, shopIds);
  const productsSubscription = Meteor.subscribe("Products/grid", scrollLimit, queryParams, sort, false);

  if (productsSubscription.ready()) {
    window.prerenderReady = true;
  }

  const activeShopsIds = Shops.find({
    $or: [
      { "workflow.status": "active" },
      { _id: Reaction.getPrimaryShopId() }
    ]
  }).map((activeShop) => activeShop._id);

  const productCursor = Catalog.find({
    ancestors: [],
    type: { $in: ["product-simple"] },
    shopId: { $in: activeShopsIds }
  }, {
    $sort: sort
  });

  // TODO: Remove
  // const sortedProducts = ReactionProduct.sortProducts(productCursor.fetch(), currentTag);
  // Session.set("productGrid/products", sortedProducts);

  // TODO: Remove
  // const productIds = [];
  // // Instantiate an object for use as a map. This object does not inherit prototype or methods from `Object`
  // const productMediaById = Object.create(null);
  // const stateProducts = sortedProducts.map((product) => {
  //   productIds.push(product._id);

  //   const primaryMedia = Media.findOneLocal({
  //     "metadata.productId": product._id,
  //     "metadata.toGrid": 1,
  //     "metadata.workflow": { $nin: ["archived", "unpublished"] }
  //   }, {
  //     sort: { "metadata.priority": 1, "uploadedAt": 1 }
  //   });

  //   const variantIds = ReactionProduct.getVariants(product._id).map((variant) => variant._id);
  //   let additionalMedia = Media.findLocal({
  //     "metadata.productId": product._id,
  //     "metadata.variantId": { $in: variantIds },
  //     "metadata.workflow": { $nin: ["archived", "unpublished"] }
  //   }, {
  //     limit: 3,
  //     sort: { "metadata.priority": 1, "uploadedAt": 1 }
  //   });

  //   if (additionalMedia.length < 2) additionalMedia = null;

  //   productMediaById[product._id] = {
  //     additionalMedia,
  //     primaryMedia
  //   };

  //   return {
  //     // ...applyProductRevision(product),
  //     // additionalMedia,
  //     // primaryMedia
  //   };
  // });

  // reactiveProductIds.set(productIds);

  canLoadMoreProducts = productCursor.count() >= Session.get("productScrollLimit");

  // const isActionViewOpen = Reaction.isActionViewOpen();
  // if (isActionViewOpen === false) {
  //   Session.set("productGrid/selectedProducts", []);
  // }
  const products = productCursor.fetch();
  onData(null, {
    canLoadMoreProducts,
    products
    // productMediaById,
    // products: stateProducts,
    // productsSubscription
  });
}

registerComponent("ProductsCustomer", ProductsComponent, [
  composeWithTracker(composer)
  // wrapComponent
]);

export default compose(
  composeWithTracker(composer),
  wrapComponent
)(ProductsComponent);
