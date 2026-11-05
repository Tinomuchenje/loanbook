import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { required } from "./util";
import { normaliseIdNumber } from "./loanMath";

export type BorrowerInput = {
  name: string;
  idNumber: string;
  address: string;
  phone: string;
  employer: string;
  sourceOfFunds: string;
};

export function cleanBorrower(args: BorrowerInput) {
  const idNumber = normaliseIdNumber(required(args.idNumber, "ID number"));
  if (idNumber.length < 5) throw new ConvexError("ID number looks too short.");
  return {
    name: required(args.name, "Name"),
    idNumber,
    address: required(args.address, "Address"),
    phone: required(args.phone, "Phone"),
    employer: required(args.employer, "Employer"),
    sourceOfFunds: required(args.sourceOfFunds, "Source of funds"),
  };
}

export async function assertIdNumberFree(ctx: MutationCtx, idNumber: string, except?: Id<"borrowers">) {
  const clash = await ctx.db
    .query("borrowers")
    .withIndex("by_idNumber", (q) => q.eq("idNumber", idNumber))
    .first();
  if (clash && clash._id !== except) {
    throw new ConvexError(`ID number ${idNumber} already belongs to ${clash.name}.`);
  }
}
