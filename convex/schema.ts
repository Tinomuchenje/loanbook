import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Money is always stored in whole cents (integers).
 * Dates are stored as "YYYY-MM-DD" strings in Harare time.
 */

export const roleValidator = v.union(v.literal("officer"), v.literal("manager"));

export const loanStatusValidator = v.union(
  v.literal("submitted"),
  v.literal("sent_back"),
  v.literal("declined"),
  v.literal("approved"),
  v.literal("active"),
  v.literal("closed"),
);

export const paymentMethodValidator = v.union(
  v.literal("cash"),
  v.literal("direct_debit"),
  v.literal("import"),
);

export default defineSchema({
  // Convex Auth's tables: sign-in accounts (email + hashed password), sessions, tokens.
  ...authTables,

  // Staff. Replaces Convex Auth's default users table; each staff member's
  // password account (in authAccounts) points at their row here.
  users: defineTable({
    email: v.string(), // lower case
    name: v.string(),
    role: roleValidator,
    active: v.boolean(),
  }).index("email", ["email"]),

  borrowers: defineTable({
    name: v.string(),
    idNumber: v.string(), // normalised: upper case, no spaces or dashes
    address: v.string(),
    phone: v.string(),
    employer: v.string(),
    sourceOfFunds: v.string(),
    createdBy: v.id("users"),
  })
    .index("by_idNumber", ["idNumber"])
    .searchIndex("search_name", { searchField: "name" }),

  loans: defineTable({
    borrowerId: v.id("borrowers"),
    status: loanStatusValidator,
    reference: v.string(), // human-friendly, e.g. LN-000123

    requestedCents: v.number(),
    requestedTermMonths: v.number(),
    purpose: v.optional(v.string()),
    documentId: v.optional(v.id("_storage")),
    documentName: v.optional(v.string()),

    // Terms locked in on the loan so a future rate change never rewrites old loans.
    monthlyRateBps: v.number(), // 1000 = 10% a month, flat on the amount lent
    processingFeeBps: v.number(), // 100 = 1%
    insuranceBps: v.number(), // 50 = 0.5%

    // Decision
    approvedCents: v.optional(v.number()),
    approvedTermMonths: v.optional(v.number()),
    decisionNote: v.optional(v.string()),
    decidedBy: v.optional(v.id("users")),
    decidedAt: v.optional(v.number()),

    // Disbursement
    disbursedOn: v.optional(v.string()),
    depositReference: v.optional(v.string()),
    processingFeeCents: v.optional(v.number()),
    insuranceCents: v.optional(v.number()),
    payoutCents: v.optional(v.number()),
    interestCents: v.optional(v.number()),
    totalRepayableCents: v.optional(v.number()),
    disbursedBy: v.optional(v.id("users")),

    paidCents: v.number(),
    closedOn: v.optional(v.string()),
    imported: v.optional(v.boolean()),

    createdBy: v.id("users"),
    submittedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_borrower", ["borrowerId"])
    .index("by_reference", ["reference"]),

  instalments: defineTable({
    loanId: v.id("loans"),
    number: v.number(),
    dueDate: v.string(),
    amountCents: v.number(),
    interestCents: v.number(),
    paidCents: v.number(),
  })
    .index("by_loan", ["loanId", "number"])
    .index("by_dueDate", ["dueDate"]),

  repayments: defineTable({
    loanId: v.id("loans"),
    paidOn: v.string(),
    amountCents: v.number(),
    method: paymentMethodValidator,
    reference: v.optional(v.string()),
    receiptNumber: v.number(),
    recordedBy: v.id("users"),
  })
    .index("by_loan", ["loanId"])
    .index("by_paidOn", ["paidOn"]),

  followUps: defineTable({
    loanId: v.id("loans"),
    note: v.string(),
    promisedDate: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_loan", ["loanId"]),

  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),
});
