import { Meteor } from "meteor/meteor";

/**
 * @name reaction/getUserId
 * @method
 * @memberof Reaction/Methods
 * @summary return server side userId if available
 * @return {String} userId - if available
 */
export default function getUserId() {
  return Meteor.userId();
}
