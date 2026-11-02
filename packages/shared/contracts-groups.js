/**
 * Shared group workflow contracts.
 *
 * This module deliberately contains public group metadata only.  It must not
 * grow fields for member profiles, phone numbers, email addresses, or other
 * personal data.  The web and API workers can depend on these types without
 * coupling their implementation details.
 */
export const GROUP_FEATURES = {
    join: "PRO4",
    leave: "PRO4",
    library: "PRO4",
    autoApprove: "PRO6",
    newMemberInvites: "PRO4",
};
