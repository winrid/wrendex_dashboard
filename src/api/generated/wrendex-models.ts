// Generated using typescript-generator version 3.2.1263 on 2026-05-03 14:03:48.

export interface AcmeAccountKey {
    id: string;
    directoryUrl: string;
    privateKeyPemEncrypted: string;
    publicKeyPem: string;
    accountUrl: string;
    createdAt: DateAsString;
}

export interface AcmeChallenge {
    id: string;
    token: string;
    keyAuthorization: string;
    subdomain: string;
    createdAt: DateAsString;
    expiresAt: DateAsString;
}

export interface Alert {
    id: string;
    pageId: string;
    siteId: string;
    crawlRunId: string;
    pageUrl: string;
    type: AlertType;
    severity: Severity;
    message: string;
    detail: string;
    createdAt: DateAsString;
    status: AlertStatus;
    lastSeenAt: DateAsString;
    resolvedAt: DateAsString;
    expiresAt: DateAsString;
    affectedUrls: string[];
    snoozedUntil: DateAsString;
    assignedToUserId: string;
}

export interface AlertRule {
    id: string;
    siteId: string;
    kind: string;
    enabled: boolean;
    params: { [index: string]: any };
    createdAt: DateAsString;
    updatedAt: DateAsString;
    lastDispatchedAt: DateAsString;
}

export interface AnonymousCrawl {
    id: string;
    token: string;
    url: string;
    siteId: string;
    crawlRunId: string;
    status: string;
    pagesDiscovered: number;
    pagesCrawled: number;
    healthScore: number;
    createdAt: DateAsString;
    expiresAt: DateAsString;
    claimedByTenantId: string;
    claimedBySiteId: string;
    claimedAt: DateAsString;
    createdByIp: string;
    claimed: boolean;
}

export interface AuditLogEntry {
    id: string;
    tenantId: string;
    actorUserId: string;
    actorEmail: string;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string;
    details: { [index: string]: any };
    createdAt: DateAsString;
}

export interface ChangelogEntry {
    id: string;
    slug: string;
    title: string;
    body: string;
    tag: ChangelogTag;
    publishedAt: DateAsString;
    createdAt: DateAsString;
    updatedAt: DateAsString;
    createdByUserId: string;
}

export interface CrawlRun {
    id: string;
    siteId: string;
    startedAt: DateAsString;
    finishedAt: DateAsString;
    status: string;
    pagesDiscovered: number;
    pagesCrawled: number;
    healthScore: number;
    errorCount: number;
    warningCount: number;
    noticeCount: number;
    errorMessage: string;
    origin: string;
    seedUrls: string[];
}

export interface EmailChannel {
    id: string;
    tenantId: string;
    kind: string;
    recipients: string[];
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface EmailDelivery {
    id: string;
    tenantId: string;
    recipient: string;
    subject: string;
    body: string;
    status: EmailDeliveryStatus;
    attemptCount: number;
    lastErrorMessage: string;
    queuedAt: DateAsString;
    sentAt: DateAsString;
    kind: EmailDeliveryKind;
}

export interface HreflangEntry {
    hreflang: string;
    href: string;
}

export interface Link {
    href: string;
    resolvedUrl: string;
    anchorText: string;
    nofollow: boolean;
    rel: string;
    context: string;
    targetStatusCode: number;
    targetContentLength: number;
    targetTimedOut: boolean;
    external: boolean;
    targetFinalStatusCode: number;
    loading: string;
    width: string;
    height: string;
    media: string;
    async: boolean;
    defer: boolean;
}

export interface Page {
    id: string;
    siteId: string;
    crawlRunId: string;
    url: string;
    statusCode: number;
    contentType: string;
    responseTimeMs: number;
    ttfbMs: number;
    contentLengthBytes: number;
    title: string;
    metaDescription: string;
    h1: string;
    canonicalUrl: string;
    robotsMeta: string;
    lang: string;
    titleCount: number;
    metaDescriptionCount: number;
    h1Count: number;
    viewportContent: string;
    wordCount: number;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    ogUrl: string;
    twitterCard: string;
    fromPageId: string;
    outgoingLinks: Link[];
    redirectChain: RedirectHop[];
    timedOut: boolean;
    redirectLoop: boolean;
    contentEncoding: string;
    hreflangEntries: HreflangEntry[];
    metaRefreshUrl: string;
    contentHash: string;
    jsonLdScripts: string[];
    crawledAt: DateAsString;
    ampPage: boolean;
    ampCustomCssBytes: number;
    ampValidationErrors: string[];
    inlineScripts: string[];
    inlineStyles: string[];
    xrobotsTag: string;
}

export interface PagerDutyChannel {
    id: string;
    tenantId: string;
    integrationKey: string;
    severityFloor: Severity;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface PagerDutyDelivery {
    id: string;
    tenantId: string;
    integrationKey: string;
    severity: string;
    dedupKey: string;
    summary: string;
    source: string;
    payloadJson: string;
    status: EmailDeliveryStatus;
    attemptCount: number;
    lastErrorMessage: string;
    queuedAt: DateAsString;
    sentAt: DateAsString;
    alertId: string;
    crawlRunId: string;
}

export interface PasswordResetToken {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: DateAsString;
    expiresAt: DateAsString;
    usedAt: DateAsString;
}

export interface PersonalApiToken {
    id: string;
    userId: string;
    name: string;
    tokenHash: string;
    prefix: string;
    scopes: string[];
    createdAt: DateAsString;
    lastUsedAt: DateAsString;
    revokedAt: DateAsString;
    expiresAt: DateAsString;
}

export interface ProcessedStripeEvent {
    id: string;
    eventId: string;
    eventType: string;
    processedAt: DateAsString;
}

export interface RedirectHop {
    url: string;
    statusCode: number;
    location: string;
}

export interface SamlResponseAudit {
    id: string;
    responseId: string;
    tenantId: string;
    processedAt: DateAsString;
    expiresAt: DateAsString;
}

export interface SavedView {
    id: string;
    tenantId: string;
    siteId: string;
    ownerUserId: string;
    name: string;
    route: string;
    filterJson: string;
    shared: boolean;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface ShareLink {
    id: string;
    tenantId: string;
    scope: ShareLinkScope;
    targetId: string;
    subResource: string;
    token: string;
    passwordHash: string;
    expiresAt: DateAsString;
    viewCount: number;
    lastViewedAt: DateAsString;
    createdByUserId: string;
    createdAt: DateAsString;
    revokedAt: DateAsString;
    label: string;
}

export interface Site {
    id: string;
    tenantId: string;
    url: string;
    createdAt: DateAsString;
    lastCrawlAt: DateAsString;
    maxPages: number;
    maxConcurrentRequests: number;
    maxRequestsPerSecond: number;
    requestTimeoutSeconds: number;
    userAgent: string;
    jsRendering: boolean;
    verificationMethod: string;
    verificationToken: string;
    verifiedAt: DateAsString;
    lastVerificationCheckAt: DateAsString;
    cadence: SiteCadence;
    nextRunAt: DateAsString;
    lastScheduledRunAt: DateAsString;
}

export interface SlackChannel {
    id: string;
    tenantId: string;
    slackTeamId: string;
    slackTeamName: string;
    accessToken: string;
    defaultChannelId: string;
    defaultChannelName: string;
    kind: string;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface SlackDelivery {
    id: string;
    tenantId: string;
    channelId: string;
    accessToken: string;
    text: string;
    blocksJson: string;
    status: EmailDeliveryStatus;
    attemptCount: number;
    lastErrorMessage: string;
    queuedAt: DateAsString;
    sentAt: DateAsString;
    alertId: string;
    crawlRunId: string;
}

export interface TeamsChannel {
    id: string;
    tenantId: string;
    webhookUrl: string;
    defaultChannelName: string;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface TeamsDelivery {
    id: string;
    tenantId: string;
    webhookUrl: string;
    channelName: string;
    text: string;
    cardJson: string;
    status: EmailDeliveryStatus;
    attemptCount: number;
    lastErrorMessage: string;
    queuedAt: DateAsString;
    sentAt: DateAsString;
    alertId: string;
    crawlRunId: string;
}

export interface TelemetryEvent {
    id: string;
    event: string;
    properties: { [index: string]: any };
    timestamp: DateAsString;
    receivedAt: DateAsString;
    sessionId: string;
    anonymousCrawlToken: string;
    userId: string;
    tenantId: string;
    ip: string;
}

export interface Tenant {
    id: string;
    name: string;
    createdAt: DateAsString;
    plan: Plan;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    subscriptionStatus: SubscriptionStatus;
    trialStartedAt: DateAsString;
    trialEndsAt: DateAsString;
    planSetAt: DateAsString;
}

export interface TenantBranding {
    id: string;
    tenantId: string;
    logoDataUrl: string;
    accentColor: string;
    fromName: string;
    hidePoweredBy: boolean;
    customSubdomain: string;
    customSubdomainVerifiedAt: DateAsString;
    lastDnsCheckAt: DateAsString;
    lastDnsCheckResult: string;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface TenantInvite {
    id: string;
    tenantId: string;
    email: string;
    role: Role;
    token: string;
    invitedByUserId: string;
    createdAt: DateAsString;
    expiresAt: DateAsString;
    acceptedAt: DateAsString;
    revokedAt: DateAsString;
}

export interface TenantMembership {
    id: string;
    userId: string;
    tenantId: string;
    role: Role;
    createdAt: DateAsString;
}

export interface TenantSamlConfig {
    id: string;
    tenantId: string;
    idpEntityId: string;
    idpSsoUrl: string;
    idpCertX509: string;
    enabled: boolean;
    configuredByUserId: string;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface TenantTlsCert {
    id: string;
    tenantId: string;
    subdomain: string;
    leafCertPem: string;
    chainPem: string;
    privateKeyPemEncrypted: string;
    issuedAt: DateAsString;
    expiresAt: DateAsString;
    renewAfter: DateAsString;
    acmeOrderUrl: string;
    status: TlsCertStatus;
    lastError: string;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface User {
    id: string;
    email: string;
    passwordHash: string;
    createdAt: DateAsString;
    totpSecret: string;
    totpEnabledAt: DateAsString;
    totpBackupCodes: string[];
}

export interface UserChangelogState {
    id: string;
    userId: string;
    lastSeenChangelogAt: DateAsString;
    updatedAt: DateAsString;
}

export type DateAsString = string;

export type AlertStatus = "OPEN" | "RESOLVED" | "IGNORED";

export type AlertType = "TITLE_MISSING" | "TITLE_TOO_LONG" | "TITLE_TOO_SHORT" | "TITLE_MULTIPLE" | "META_DESCRIPTION_MISSING" | "META_DESCRIPTION_TOO_LONG" | "META_DESCRIPTION_TOO_SHORT" | "META_DESCRIPTION_MULTIPLE" | "H1_MISSING" | "H1_MULTIPLE" | "HTTP_404" | "HTTP_403" | "HTTP_409" | "HTTP_4XX" | "HTTP_500" | "HTTP_5XX" | "NOINDEX_PAGE" | "NOFOLLOW_PAGE" | "NOINDEX_FOLLOW" | "NOINDEX_NOFOLLOW" | "NOINDEX_CONFLICT" | "NOFOLLOW_CONFLICT" | "INVALID_LANG" | "MISSING_VIEWPORT" | "LOW_WORD_COUNT" | "SLOW_PAGE" | "OVERSIZED_HTML" | "NO_COMPRESSION" | "SLOW_TTFB" | "NO_OUTGOING_LINKS" | "DOUBLE_SLASH_URL" | "TOO_MANY_URL_PARAMS" | "MISSING_ALT_TEXT" | "BROKEN_IMAGE" | "OVERSIZED_IMAGE" | "IMAGE_REDIRECT" | "MISSING_IMAGE_DIMENSIONS" | "MISSING_OG_TAGS" | "OG_CANONICAL_MISMATCH" | "MISSING_TWITTER_CARD" | "REDIRECT_302" | "REDIRECT_3XX" | "BROKEN_REDIRECT" | "REDIRECT_CHAIN" | "REDIRECT_CHAIN_TOO_LONG" | "REDIRECT_LOOP" | "HTTPS_TO_HTTP_REDIRECT" | "HTTP_TO_HTTPS_REDIRECT" | "META_REFRESH_REDIRECT" | "TIMEOUT" | "HTTPS_LINKS_TO_HTTP" | "HTTP_LINKS_TO_HTTPS" | "HTTPS_CSS_TO_HTTP" | "HTTPS_JS_TO_HTTP" | "HTTPS_IMG_TO_HTTP" | "INVALID_HREFLANG" | "HREFLANG_LANG_MISMATCH" | "HREFLANG_MISSING_SELF_REF" | "HREFLANG_MISSING_X_DEFAULT" | "CANONICAL_POINTS_TO_4XX" | "CANONICAL_POINTS_TO_5XX" | "CANONICAL_POINTS_TO_REDIRECT" | "CANONICAL_NO_INCOMING_LINKS" | "CANONICAL_HTTP_TO_HTTPS" | "CANONICAL_HTTPS_TO_HTTP" | "NON_CANONICAL_AS_CANONICAL" | "LINKS_TO_REDIRECT_INDEXABLE" | "LINKS_TO_REDIRECT_NON_INDEXABLE" | "LINKS_TO_BROKEN_NON_INDEXABLE" | "NOFOLLOW_ONLY_INCOMING" | "MIXED_FOLLOW_INCOMING" | "NOFOLLOW_OUTGOING_INTERNAL" | "SINGLE_DOFOLLOW_INCOMING" | "REDIRECT_NO_INCOMING" | "HREFLANG_POINTS_TO_BROKEN" | "HREFLANG_POINTS_TO_REDIRECT" | "HREFLANG_MISSING_RECIPROCAL" | "HREFLANG_POINTS_TO_NON_CANONICAL" | "HREFLANG_MULTI_LANG_SINGLE_PAGE" | "HREFLANG_MULTI_PAGE_SINGLE_LANG" | "IDENTICAL_CONTENT" | "DUPLICATES_NO_CANONICAL" | "BROKEN_CSS" | "OVERSIZED_CSS" | "REDIRECTED_CSS" | "BROKEN_JS" | "OVERSIZED_JS" | "REDIRECTED_JS" | "EXTERNAL_LINK_3XX" | "EXTERNAL_LINK_4XX" | "EXTERNAL_LINK_BLOCKED" | "EXTERNAL_LINK_5XX" | "EXTERNAL_LINK_TIMEOUT" | "EXTERNAL_LINK_5XX_REDIRECT" | "RENDER_BLOCKING_CSS" | "RENDER_BLOCKING_JS" | "ROBOTS_TXT_INACCESSIBLE" | "TITLE_CHANGED" | "META_DESCRIPTION_CHANGED" | "H1_CHANGED" | "WORD_COUNT_CHANGED" | "REDIRECT_TARGET_CHANGED" | "BECAME_NON_INDEXABLE" | "SITEMAP_3XX_REDIRECT" | "SITEMAP_4XX" | "SITEMAP_403_FORBIDDEN" | "SITEMAP_5XX" | "SITEMAP_NOINDEX" | "SITEMAP_NON_CANONICAL" | "SITEMAP_TIMEOUT" | "INVALID_SITEMAP_FORMAT" | "MISSING_FROM_SITEMAP" | "DUPLICATE_IN_SITEMAPS" | "JSON_LD_PARSE_ERROR" | "JSON_LD_MISSING_TYPE" | "JSON_LD_INVALID_TYPE" | "JSON_LD_INVALID_PROPERTY" | "JSON_LD_UNEXPECTED_PROPERTY_TYPE" | "JSON_LD_UNEXPECTED_PROPERTY" | "JSON_LD_INVALID_VALUE" | "JSON_LD_DUPLICATE_PROPERTY" | "JSON_LD_DEPRECATED_TYPE" | "JSON_LD_DEPRECATED_PROPERTY" | "JSON_LD_GOOGLE_MISSING_REQUIRED" | "JSON_LD_GOOGLE_MISSING_ONE_OF_REQUIRED" | "JSON_LD_GOOGLE_PROPERTY_MISSING_TYPE" | "JSON_LD_GOOGLE_MISSING_IMAGE" | "JSON_LD_GOOGLE_INVALID_DATE" | "JSON_LD_GOOGLE_UNRECOGNIZED_PROPERTY" | "JSON_LD_GOOGLE_UNRESOLVED_ID" | "JSON_LD_GOOGLE_EMPTY_FIELD" | "JSON_LD_GOOGLE_INVALID_VALUE" | "DUPLICATE_TITLE" | "DUPLICATE_META_DESCRIPTION" | "DUPLICATE_H1" | "ORPHAN_PAGE" | "LINKS_TO_BROKEN" | "AMP_VALIDATION_ERRORS" | "AMP_CANONICAL_MISMATCH" | "AMP_EXCESSIVE_CSS" | "DUPLICATE_JS_CODE" | "DUPLICATE_CSS_CODE";

export type AuditAction = "INVITE_CREATED" | "INVITE_REVOKED" | "INVITE_ACCEPTED" | "INVITE_RESENT" | "MEMBER_ROLE_CHANGED" | "MEMBER_REMOVED" | "OWNERSHIP_TRANSFERRED" | "SITE_CREATED" | "SITE_DELETED" | "CHANNEL_INSTALLED" | "CHANNEL_REMOVED" | "PLAN_CHANGED" | "BRANDING_UPDATED" | "CHANGELOG_PUBLISHED" | "CHANGELOG_UPDATED" | "CHANGELOG_DELETED" | "SAML_CONFIG_UPDATED";

export type AuditTargetType = "TENANT" | "SITE" | "MEMBERSHIP" | "INVITE" | "CHANNEL" | "CHANGELOG";

export type ChangelogTag = "NEW" | "IMPROVED" | "FIX" | "BREAKING";

export type EmailDeliveryKind = "PASSWORD_RESET" | "ALERT" | "DIGEST" | "INVITE" | "OTHER";

export type EmailDeliveryStatus = "QUEUED" | "SENT" | "FAILED";

export type Severity = "ERROR" | "WARNING" | "NOTICE";

export type ShareLinkScope = "SITE" | "CRAWL_REPORT" | "PAGE_DETAIL";

export type SiteCadence = "PAUSED" | "DAILY" | "HOURLY" | "CONTINUOUS";

export type SubscriptionStatus = "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "INCOMPLETE";

export type TlsCertStatus = "PROVISIONING" | "ACTIVE" | "RENEWING" | "FAILED";

export type Plan = "STARTER" | "PROFESSIONAL" | "AGENCY";

export type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
