import { httpRouter } from "convex/server";
import { auth } from "./auth";

// Serves the public keys Convex uses to check sign-in tokens.
const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
