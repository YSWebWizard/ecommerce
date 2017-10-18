import _ from "lodash";
import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { ServiceConfiguration } from "meteor/service-configuration";
import { Reaction } from "/server/api";

/**
 * @name updateServiceConfiguration
 * @memberof Meteor/Accounts
 * @method
 * @example Meteor.call("accounts/updateServiceConfiguration", service, fields, (callBackFunction))
 * @summary Update service configuration
 * @param {String} service
 * @param {Array} fields
 * @returns {false}
 */
Meteor.methods({
  "accounts/updateServiceConfiguration": function (service, fields) {
    check(service, String);
    check(fields, Array);
    const dataToSave = {};

    _.each(fields, function (field) {
      dataToSave[field.property] = field.value;
    });

    if (Reaction.hasPermission(["dashboard/accounts"])) {
      return ServiceConfiguration.configurations.upsert({
        service: service
      }, {
        $set: dataToSave
      });
    }
    return false;
  }
});
