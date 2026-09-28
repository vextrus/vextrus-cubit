/*
 * The root route. Ticket 03 builds the frame (web/src/app/, routes/_app/) and its "Page not found";
 * this route only holds the outlet. Routes hold no words (eslint.config.js).
 */
import { Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({ component: Outlet })
