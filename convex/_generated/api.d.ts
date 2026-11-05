/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as arrears from "../arrears.js";
import type * as auth from "../auth.js";
import type * as borrowers from "../borrowers.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as importer from "../importer.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_borrowerRules from "../lib/borrowerRules.js";
import type * as lib_loanData from "../lib/loanData.js";
import type * as lib_loanMath from "../lib/loanMath.js";
import type * as lib_repaymentRules from "../lib/repaymentRules.js";
import type * as lib_staffAccounts from "../lib/staffAccounts.js";
import type * as lib_util from "../lib/util.js";
import type * as loans from "../loans.js";
import type * as repayments from "../repayments.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  arrears: typeof arrears;
  auth: typeof auth;
  borrowers: typeof borrowers;
  dashboard: typeof dashboard;
  http: typeof http;
  importer: typeof importer;
  "lib/auth": typeof lib_auth;
  "lib/borrowerRules": typeof lib_borrowerRules;
  "lib/loanData": typeof lib_loanData;
  "lib/loanMath": typeof lib_loanMath;
  "lib/repaymentRules": typeof lib_repaymentRules;
  "lib/staffAccounts": typeof lib_staffAccounts;
  "lib/util": typeof lib_util;
  loans: typeof loans;
  repayments: typeof repayments;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
