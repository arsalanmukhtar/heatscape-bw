// MOCK users until Keycloak exists: email and password come from the environment (.env);
// a user without a password cannot sign in. Roles follow docs/architecture.md
// (public, planner, partner, expert, admin).
const env = process.env;

export const USERS = [
  {
    id: 'u-admin',
    email: (env.ADMIN_EMAIL || 'admin@heatscape.local').toLowerCase(),
    password: env.ADMIN_PASSWORD || null,
    name: 'M. Arsalan',
    initials: 'MA',
    org: 'HEATSCAPE-BW',
    roles: ['admin', 'planner'],
    emailVerified: true,
  },
  {
    id: 'u-planner',
    email: (env.PLANNER_EMAIL || 'planner@heatscape.local').toLowerCase(),
    password: env.PLANNER_PASSWORD || null,
    name: 'J. Weber',
    initials: 'JW',
    org: 'Stadt Mannheim',
    roles: ['planner'],
    emailVerified: false,
  },
];

/** The user as the browser may see it (never the password). */
export const publicUser = ({ password, ...user }) => user;
