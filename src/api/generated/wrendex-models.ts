
export interface CreateApiTokenResponse {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    createdAt: DateAsString;
    lastUsedAt: DateAsString | null;
    revokedAt: DateAsString | null;
    expiresAt: DateAsString | null;
    token: string;
}

export interface PersonalApiTokenDto {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    createdAt: DateAsString;
    lastUsedAt: DateAsString | null;
    revokedAt: DateAsString | null;
    expiresAt: DateAsString | null;
}

export interface Setup2faResponse {
    secret: string;
    otpauthUrl: string;
}

export interface TwoFactorStatusResponse {
    enabled: boolean;
    enabledAt: DateAsString;
    backupCodesRemaining: number;
}

export interface Verify2faResponse {
    backupCodes: string[];
}

export interface BulkActionResponse {
    updatedCount: number;
}

export interface AnonymousCrawlClaimResponse {
    siteId: string;
    crawlRunId: string;
    claimedAt: string;
}

export interface AnonymousCrawlFull {
    token: string;
    url: string;
    status: string;
    crawlRunId: string | null;
    siteId: string | null;
    issuesSummary: IssuesSummary;
    alerts: Alert[];
    isClaimed: boolean;
    claimedByTenantId: string;
    claimedAt: string | null;
}

export interface AnonymousCrawlLastScrapedPage {
    url: string;
    title: string | null;
    crawledAt: string | null;
}

export interface AnonymousCrawlPostProcessingProgress {
    phase: string;
    label: string;
    completed: number;
    total: number;
    updatedAt: string;
}

export interface AnonymousCrawlStartResponse {
    token: string;
    crawlRunId: string;
    status: string;
    deduplicated: boolean | null;
}

export interface AnonymousCrawlSummary {
    token: string;
    url: string;
    status: string;
    crawlRunId: string | null;
    healthScore: number | null;
    pagesCrawled: number;
    pagesDiscovered: number;
    issuesSummary: IssuesSummary;
    isClaimed: boolean;
    claimedByTenantId: string | null;
    startedAt: string;
    finishedAt: string | null;
    expiresAt: string | null;
    lastScrapedPage: AnonymousCrawlLastScrapedPage | null;
    postProcessingProgress: AnonymousCrawlPostProcessingProgress | null;
}

export interface AuditLogEntryDto {
    id: string;
    tenantId: string;
    actorUserId: string | null;
    actorEmail: string | null;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string | null;
    details: { [index: string]: any } | null;
    createdAt: DateAsString;
}

export interface AuditLogResult {
    items: AuditLogEntryDto[];
    total: number;
    page: number;
    size: number;
}

export interface AuthLoginResponse {
    sessionToken: string;
    user: UserDto;
    twoFactorRequired: boolean;
}

export interface AuthSignupResponse {
    sessionToken: string;
    user: UserDto;
    tenant: TenantDto;
    role: Role;
}

export interface HealthResponse {
    status: string;
    now: string;
}

export interface MeResponse {
    user: UserDto;
    memberships: MembershipDto[];
    activeTenantId: string | null;
}

export interface MembershipDto {
    tenantId: string;
    tenantName: string;
    role: Role;
}

export interface UserDto {
    id: string;
    email: string;
    createdAt: DateAsString;
}

export interface AutoTopUpResponse {
    enabled: boolean;
    packSku: string;
    thresholdCredits: number;
}

export interface CheckoutSessionResponse {
    url: string;
    sessionId: string;
}

export interface CreditLedgerEntryDto {
    id: string;
    kind: Kind;
    amount: number;
    balanceAfter: number;
    crawlRunId: string | null;
    pageId: string | null;
    url: string | null;
    source: string | null;
    occurredAt: string | null;
}

export interface CreditLedgerResponse {
    items: CreditLedgerEntryDto[];
}

export interface InvoiceDto {
    id: string;
    number: string | null;
    amount: number;
    currency: string;
    status: string;
    hostedInvoiceUrl: string | null;
    invoicePdfUrl: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    paidAt: string | null;
    createdAt: string;
}

export interface ListInvoicesResponse {
    items: InvoiceDto[];
}

export interface ManualTopUpResponse {
    paymentIntentId: string;
    status: string;
}

export interface PortalSessionResponse {
    url: string;
}

export interface SetupIntentResponse {
    clientSecret: string;
    customerId: string;
}

export interface CheckCatalogEntry {
    type: string;
    category: string;
    severityDefault: string;
    title: string;
    description: string;
    howToFix: string;
    marketingId: string;
}

export interface ChangelogEntryDto {
    id: string;
    slug: string;
    title: string;
    body: string;
    tag: ChangelogTag;
    publishedAt: DateAsString | null;
    createdAt: DateAsString;
    updatedAt: DateAsString;
    createdByUserId: string;
}

export interface ChangelogListResponse {
    items: ChangelogEntryDto[];
    total: number;
}

export interface ChangelogUnreadResponse {
    unreadCount: number;
    latestPublishedAt: DateAsString;
}

export interface EmailChannelDto {
    id: string;
    tenantId: string;
    kind: string;
    recipients: string[];
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface PagerDutyChannelDto {
    id: string;
    tenantId: string;
    severityFloor: Severity;
    integrationKeyConfigured: boolean;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface SlackChannelDto {
    id: string;
    tenantId: string;
    slackTeamId: string | null;
    slackTeamName: string | null;
    defaultChannelId: string | null;
    defaultChannelName: string | null;
    kind: string | null;
    accessTokenConfigured: boolean;
    createdAt: DateAsString | null;
    updatedAt: DateAsString | null;
}

export interface SlackEphemeralResponse {
    text: string;
    response_type: ResponseType;
}

export interface SlackInstallStartResponse {
    url: string;
}

export interface TeamsChannelDto {
    id: string;
    tenantId: string;
    defaultChannelName: string;
    webhookUrlConfigured: boolean;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface TelemetryIngestResponse {
    accepted: number;
    rejected: number;
}

export interface CrawlDiffResponse {
    resolved: Alert[];
    persisted: Alert[];
    skipped: Alert[];
    newCount: number;
    resolvedCount: number;
    persistedCount: number;
    skippedCount: number;
    newTruncated: boolean;
    resolvedTruncated: boolean;
    persistedTruncated: boolean;
    skippedTruncated: boolean;
    new: Alert[];
}

export interface SiteScheduleResponse {
    cadence: SiteCadence;
    nextRunAt: DateAsString;
    lastScheduledRunAt: DateAsString;
}

export interface ApiErrorResponse {
    code: string;
    message: string;
    details: { [index: string]: any };
}

export interface NotificationLogEntry {
    id: string;
    tenantId: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    attemptCount: number;
    lastErrorMessage: string | null;
    queuedAt: DateAsString;
    sentAt: DateAsString | null;
    recipient: string;
    subject: string;
    alertId: string | null;
    alertType: string | null;
    siteId: string | null;
}

export interface NotificationLogResult {
    items: NotificationLogEntry[];
    total: number;
    page: number;
    size: number;
}

export interface NotificationResendResponse {
    newDeliveryId: string;
}

export interface AlertQueryResult {
    items: Alert[];
    total: number;
    page: number;
    size: number;
}

export interface CategorySummary {
    category: string;
    errorCount: number;
    warningCount: number;
    noticeCount: number;
    byType: { [index: string]: number };
}

export interface CrawlLogEntry {
    id: string;
    startedAt: DateAsString;
    finishedAt: DateAsString | null;
    durationMs: number | null;
    status: string;
    pagesDiscovered: number;
    pagesCrawled: number;
    healthScore: number;
    errorCount: number;
    warningCount: number;
    noticeCount: number;
}

export interface DirectoryNode {
    path: string;
    pageCount: number;
    avgResponseTimeMs: number;
    avgWordCount: number;
    statusCodeCounts: { [index: string]: number };
}

export interface DuplicateCodeEntry {
    alertId: string;
    pageUrl: string;
    language: string;
    tokenCount: number | null;
    sourceA: string;
    sourceB: string;
    message: string;
    snippet: string | null;
}

export interface DuplicateCodeLanguageStats {
    alertCount: number;
    totalTokens: number;
    avgTokens: number;
    maxTokens: number;
}

export interface DuplicateCodeResult {
    stats: DuplicateCodeStats | null;
    entries: DuplicateCodeEntry[];
}

export interface DuplicateCodeStats {
    js: DuplicateCodeLanguageStats;
    css: DuplicateCodeLanguageStats;
}

export interface DuplicateGroup {
    hash: string | null;
    urls: string[];
    field: string;
    value: string | null;
}

export interface DuplicatesResult {
    groups: DuplicateGroup[];
    totalDuplicateGroups: number;
}

export interface HealthScorePoint {
    crawlRunId: string;
    startedAt: DateAsString;
    finishedAt: DateAsString | null;
    healthScore: number;
    errorCount: number;
    warningCount: number;
    noticeCount: number;
}

export interface IssuesSummary {
    totalIssues: number;
    bySeverity: { [index: string]: number };
    byCategory: CategorySummary[];
    duplicateCodeStats: DuplicateCodeStats | null;
}

export interface LinkEntry {
    sourceUrl: string;
    targetUrl: string;
    anchorText: string;
    nofollow: boolean;
    context: string | null;
    external: boolean;
    targetStatusCode: number;
}

export interface LinkResult {
    links: LinkEntry[];
    total: number;
    page: number;
    size: number;
}

export interface PageResult {
    pages: PageRow[];
    total: number;
    page: number;
    size: number;
}

export interface PageRow {
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
    etag: string;
    lastModified: string;
    xrobotsTag: string;
    errorCount: number;
    warningCount: number;
    noticeCount: number;
    indexable: boolean;
}

export interface RedirectEntry {
    sourceUrl: string;
    finalUrl: string;
    statusCode: number;
    chainLength: number;
    hops: RedirectHop[];
    loop: boolean;
    hasMetaRefresh: boolean;
    originatingPages: string[];
}

export interface RedirectsResult {
    entries: RedirectEntry[];
    totalChains: number;
    totalLoops: number;
}

export interface ResourceEntry {
    url: string;
    type: string;
    sourcePageCount: number;
    bytes: number;
    renderBlocking: boolean;
    duplicateTracker: boolean;
    originatingPages: string[];
}

export interface ResourcesResult {
    resources: ResourceEntry[];
    totalCss: number;
    totalJs: number;
    totalImages: number;
}

export interface SocialEntry {
    url: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    ogUrl: string;
    twitterCard: string;
    hasOg: boolean;
    hasTwitter: boolean;
}

export interface SocialResult {
    entries: SocialEntry[];
    totalPages: number;
    pagesWithOg: number;
    pagesWithTwitter: number;
    pagesWithNeither: number;
}

export interface StructuredDataEntry {
    url: string;
    scriptCount: number;
    types: string[];
}

export interface StructuredDataResult {
    entries: StructuredDataEntry[];
    totalPagesWithStructuredData: number;
    totalScripts: number;
    typeCounts: { [index: string]: number };
}

export interface SearchResponse {
    items: SearchResultDto[];
    truncated: boolean;
}

export interface SearchResultDto {
    kind: SearchResultKind;
    id: string;
    title: string;
    snippet: string;
    route: string;
}

export interface CrawlReportIssuesPayload {
    crawlRun: CrawlRun | null;
    issuesSummary: IssuesSummary | null;
}

export interface PageDetailSharePayload {
    page: PageRow | null;
    pageAlerts: Alert[];
}

export interface PasswordRequiredResponse {
    passwordRequired: boolean;
}

export interface ResolveShareResponse {
    share: SharedLinkInfo;
    payload: any;
}

export interface ShareLinkDto {
    id: string;
    tenantId: string;
    scope: ShareLinkScope;
    targetId: string;
    subResource: string | null;
    token: string;
    url: string;
    label: string | null;
    passwordProtected: boolean;
    expiresAt: DateAsString | null;
    createdByUserId: string | null;
    createdByEmail: string | null;
    createdAt: DateAsString;
    revokedAt: DateAsString | null;
    viewCount: number;
    lastViewedAt: DateAsString | null;
    planLimit: number | null;
    planUsed: number | null;
}

export interface SharedLinkInfo {
    scope: ShareLinkScope;
    targetId: string;
    subResource: string | null;
    label: string | null;
    expiresAt: DateAsString | null;
    tenantName: string;
    logoDataUrl: string | null;
    accentColor: string | null;
    hidePoweredBy: boolean;
    siteDisplayName: string | null;
}

export interface SiteSharePayload {
    site: Site;
    latestCrawl: CrawlRun | null;
    healthScore: HealthScorePoint[];
    issuesSummary: IssuesSummary | null;
}

export interface StatusComponent {
    id: string;
    name: string;
    status: StatusLevel;
    metric: string | null;
    updatedAt: string | null;
}

export interface StatusIncident {
    id: string;
    componentId: string | null;
    status: StatusLevel | null;
    title: string | null;
    body: string | null;
    startedAt: string | null;
    resolvedAt: string | null;
}

export interface StatusResponse {
    status: StatusLevel;
    components: StatusComponent[];
    incidents: StatusIncident[] | null;
    sloTargets: StatusSloTargets | null;
    updatedAt: string;
}

export interface StatusSloTargets {
    api: number;
    crawler: number;
    schedulerP95Ms: number;
}

export interface ProvisionTlsResponse {
    status: TlsCertStatus;
    subdomain: string;
}

export interface SiteVerificationConfirmation {
    verified: boolean;
    lastCheckedAt: DateAsString;
}

export interface SiteVerificationResponse {
    method: string;
    token: string;
    instructions: string;
}

export interface TenantBrandingDto {
    tenantId: string;
    logoDataUrl: string | null;
    accentColor: string | null;
    fromName: string | null;
    hidePoweredBy: boolean | null;
    customSubdomain: string | null;
    customSubdomainVerifiedAt: DateAsString | null;
    lastDnsCheckAt: DateAsString | null;
    lastDnsCheckResult: string | null;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface TenantDto {
    id: string;
    name: string;
    createdAt: DateAsString;
}

export interface TenantInviteAcceptResponse {
    tenantId: string;
    role: Role;
}

export interface TenantInviteDto {
    id: string;
    tenantId: string;
    email: string;
    role: Role;
    invitedByUserId: string;
    invitedByEmail: string;
    createdAt: DateAsString;
    expiresAt: DateAsString;
}

export interface TenantInvitePeekResponse {
    tenantId: string;
    tenantName: string;
    email: string;
    role: Role;
    invitedByEmail: string;
}

export interface TenantMemberDto {
    id: string;
    userId: string;
    tenantId: string;
    email: string;
    role: Role;
    joinedAt: DateAsString;
    lastSeenAt: DateAsString | null;
}

export interface TenantSamlConfigDto {
    tenantId: string;
    idpEntityId: string;
    idpSsoUrl: string;
    idpCertX509: string;
    enabled: boolean;
    configuredByUserId: string;
    createdAt: DateAsString;
    updatedAt: DateAsString;
}

export interface TenantTlsCertDto {
    subdomain: string;
    status: TlsCertStatus;
    issuedAt: DateAsString | null;
    expiresAt: DateAsString | null;
    renewAfter: DateAsString | null;
    lastError: string | null;
}

export interface TenantTlsCertRouterEntry {
    subdomain: string;
    leafCertPem: string;
    chainPem: string;
    privateKeyPem: string;
    issuedAt: DateAsString;
    expiresAt: DateAsString;
    updatedAt: DateAsString;
}

export interface TransferOwnershipResponse {
    previousOwner: TenantMemberDto;
    newOwner: TenantMemberDto;
}

export interface VerifySubdomainResponse {
    verified: boolean;
    customSubdomain: string | null;
    expectedTarget: string;
    resolvedTarget: string;
    lastDnsCheckResult: string | null;
    lastDnsCheckAt: DateAsString | null;
    customSubdomainVerifiedAt: DateAsString;
}

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
    tokenCount: number | null;
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
    canonicalUrl: string;
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

export interface AutoTopUpSettings {
    enabled: boolean;
    packSku: string;
    thresholdCredits: number;
}

export interface BillingSnapshotResponse {
    plan: string;
    subscriptionStatus: SubscriptionStatus;
    trialStartedAt: DateAsString;
    trialEndsAt: DateAsString;
    hasPaymentMethod: boolean;
    creditBalance: number;
    creditsGrantedThisCycle: number;
    cycleStartedAt: DateAsString;
    cycleEndsAt: DateAsString;
    autoTopUp: AutoTopUpSettings;
    topUpInFlight: boolean;
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

export interface CrawlCostResponse {
    httpCount: number;
    browserCount: number;
    changeDetectCount: number;
    totalCredits: number;
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
    lastHeartbeatAt: DateAsString;
    origin: string;
    seedUrls: string[];
    postProcessingPhase: string;
    postProcessingProgress: PostProcessingProgress;
}

export interface CreditLedgerEntry {
    id: string;
    tenantId: string;
    crawlRunId: string;
    pageId: string;
    url: string;
    kind: Kind;
    amount: number;
    balanceAfter: number;
    occurredAt: DateAsString;
    source: string;
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

export interface LinkEdge {
    id: string;
    siteId: string;
    crawlRunId: string;
    fromPageId: string;
    fromUrl: string;
    toUrl: string;
    href: string;
    anchorText: string;
    context: string;
    rel: string;
    nofollow: boolean;
    external: boolean;
    loading: string;
    width: string;
    height: string;
    media: string;
    async: boolean;
    defer: boolean;
    targetStatusCode: number;
    targetContentLength: number;
    targetTimedOut: boolean;
    targetFinalStatusCode: number;
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
    etag: string;
    lastModified: string;
    xrobotsTag: string;
}

export interface PageSummary {
    id: string;
    siteId: string;
    crawlRunId: string;
    fromPageId: string;
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
    redirectChain: RedirectHop[];
    timedOut: boolean;
    redirectLoop: boolean;
    contentEncoding: string;
    hreflangEntries: HreflangEntry[];
    metaRefreshUrl: string;
    contentHash: string;
    crawledAt: DateAsString;
    ampPage: boolean;
    ampCustomCssBytes: number;
    etag: string;
    lastModified: string;
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

export interface PostProcessingProgress {
    phase: string;
    label: string;
    completed: number;
    total: number;
    updatedAt: DateAsString;
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
    maxFetchAttempts: number;
    fetchBackoffBaseMs: number;
    fetchBackoffMaxMs: number;
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
    plan: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    subscriptionStatus: SubscriptionStatus;
    trialStartedAt: DateAsString;
    trialEndsAt: DateAsString;
    planSetAt: DateAsString;
    hostRpsOverride: number;
    hostBurstOverride: number;
    creditBalance: number;
    cycleStartedAt: DateAsString;
    cycleEndsAt: DateAsString;
    creditsGrantedThisCycle: number;
    autoTopUpEnabled: boolean;
    autoTopUpPackSku: string;
    autoTopUpThreshold: number;
    topUpInFlightIntentId: string;
    topUpInFlightStartedAt: DateAsString;
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

export type ResponseType = "ephemeral" | "in_channel";

export type NotificationChannel = "EMAIL" | "SLACK" | "TEAMS" | "PAGERDUTY";

export type NotificationStatus = "QUEUED" | "SENT" | "FAILED";

export type SearchResultKind = "site" | "page" | "alert" | "check";

export type StatusLevel = "operational" | "degraded" | "down";

export type AlertStatus = "OPEN" | "RESOLVED" | "IGNORED";

export type AlertType = "TITLE_MISSING" | "TITLE_TOO_LONG" | "TITLE_TOO_SHORT" | "TITLE_MULTIPLE" | "META_DESCRIPTION_MISSING" | "META_DESCRIPTION_TOO_LONG" | "META_DESCRIPTION_TOO_SHORT" | "META_DESCRIPTION_MULTIPLE" | "H1_MISSING" | "H1_MULTIPLE" | "HTTP_404" | "HTTP_403" | "HTTP_409" | "HTTP_4XX" | "HTTP_500" | "HTTP_5XX" | "NOINDEX_PAGE" | "NOFOLLOW_PAGE" | "NOINDEX_FOLLOW" | "NOINDEX_NOFOLLOW" | "NOINDEX_CONFLICT" | "NOFOLLOW_CONFLICT" | "INVALID_LANG" | "MISSING_VIEWPORT" | "LOW_WORD_COUNT" | "SLOW_PAGE" | "OVERSIZED_HTML" | "NO_COMPRESSION" | "SLOW_TTFB" | "NO_OUTGOING_LINKS" | "DOUBLE_SLASH_URL" | "TOO_MANY_URL_PARAMS" | "MISSING_ALT_TEXT" | "BROKEN_IMAGE" | "OVERSIZED_IMAGE" | "IMAGE_REDIRECT" | "MISSING_IMAGE_DIMENSIONS" | "MISSING_OG_TAGS" | "OG_CANONICAL_MISMATCH" | "MISSING_TWITTER_CARD" | "REDIRECT_302" | "REDIRECT_3XX" | "BROKEN_REDIRECT" | "REDIRECT_CHAIN" | "REDIRECT_CHAIN_TOO_LONG" | "REDIRECT_LOOP" | "HTTPS_TO_HTTP_REDIRECT" | "HTTP_TO_HTTPS_REDIRECT" | "META_REFRESH_REDIRECT" | "TIMEOUT" | "HTTPS_LINKS_TO_HTTP" | "HTTP_LINKS_TO_HTTPS" | "HTTPS_CSS_TO_HTTP" | "HTTPS_JS_TO_HTTP" | "HTTPS_IMG_TO_HTTP" | "INVALID_HREFLANG" | "HREFLANG_LANG_MISMATCH" | "HREFLANG_MISSING_SELF_REF" | "HREFLANG_MISSING_X_DEFAULT" | "CANONICAL_POINTS_TO_4XX" | "CANONICAL_POINTS_TO_5XX" | "CANONICAL_POINTS_TO_REDIRECT" | "CANONICAL_NO_INCOMING_LINKS" | "CANONICAL_HTTP_TO_HTTPS" | "CANONICAL_HTTPS_TO_HTTP" | "NON_CANONICAL_AS_CANONICAL" | "LINKS_TO_REDIRECT_INDEXABLE" | "LINKS_TO_REDIRECT_NON_INDEXABLE" | "LINKS_TO_BROKEN_NON_INDEXABLE" | "NOFOLLOW_ONLY_INCOMING" | "MIXED_FOLLOW_INCOMING" | "NOFOLLOW_OUTGOING_INTERNAL" | "SINGLE_DOFOLLOW_INCOMING" | "REDIRECT_NO_INCOMING" | "HREFLANG_POINTS_TO_BROKEN" | "HREFLANG_POINTS_TO_REDIRECT" | "HREFLANG_MISSING_RECIPROCAL" | "HREFLANG_POINTS_TO_NON_CANONICAL" | "HREFLANG_MULTI_LANG_SINGLE_PAGE" | "HREFLANG_MULTI_PAGE_SINGLE_LANG" | "IDENTICAL_CONTENT" | "DUPLICATES_NO_CANONICAL" | "BROKEN_CSS" | "OVERSIZED_CSS" | "REDIRECTED_CSS" | "BROKEN_JS" | "OVERSIZED_JS" | "REDIRECTED_JS" | "EXTERNAL_LINK_3XX" | "EXTERNAL_LINK_4XX" | "EXTERNAL_LINK_BLOCKED" | "EXTERNAL_LINK_5XX" | "EXTERNAL_LINK_TIMEOUT" | "EXTERNAL_LINK_5XX_REDIRECT" | "RENDER_BLOCKING_CSS" | "RENDER_BLOCKING_JS" | "ROBOTS_TXT_INACCESSIBLE" | "TITLE_CHANGED" | "META_DESCRIPTION_CHANGED" | "H1_CHANGED" | "WORD_COUNT_CHANGED" | "REDIRECT_TARGET_CHANGED" | "BECAME_NON_INDEXABLE" | "SITEMAP_3XX_REDIRECT" | "SITEMAP_4XX" | "SITEMAP_403_FORBIDDEN" | "SITEMAP_5XX" | "SITEMAP_NOINDEX" | "SITEMAP_NON_CANONICAL" | "SITEMAP_TIMEOUT" | "INVALID_SITEMAP_FORMAT" | "MISSING_FROM_SITEMAP" | "DUPLICATE_IN_SITEMAPS" | "JSON_LD_PARSE_ERROR" | "JSON_LD_MISSING_TYPE" | "JSON_LD_INVALID_TYPE" | "JSON_LD_INVALID_PROPERTY" | "JSON_LD_UNEXPECTED_PROPERTY_TYPE" | "JSON_LD_UNEXPECTED_PROPERTY" | "JSON_LD_INVALID_VALUE" | "JSON_LD_DUPLICATE_PROPERTY" | "JSON_LD_DEPRECATED_TYPE" | "JSON_LD_DEPRECATED_PROPERTY" | "JSON_LD_GOOGLE_MISSING_REQUIRED" | "JSON_LD_GOOGLE_MISSING_ONE_OF_REQUIRED" | "JSON_LD_GOOGLE_PROPERTY_MISSING_TYPE" | "JSON_LD_GOOGLE_MISSING_IMAGE" | "JSON_LD_GOOGLE_INVALID_DATE" | "JSON_LD_GOOGLE_UNRECOGNIZED_PROPERTY" | "JSON_LD_GOOGLE_UNRESOLVED_ID" | "JSON_LD_GOOGLE_EMPTY_FIELD" | "JSON_LD_GOOGLE_INVALID_VALUE" | "DUPLICATE_TITLE" | "DUPLICATE_META_DESCRIPTION" | "DUPLICATE_H1" | "ORPHAN_PAGE" | "LINKS_TO_BROKEN" | "AMP_VALIDATION_ERRORS" | "AMP_CANONICAL_MISMATCH" | "AMP_EXCESSIVE_CSS" | "DUPLICATE_JS_CODE" | "DUPLICATE_CSS_CODE" | "OUT_OF_CREDITS";

export type AuditAction = "INVITE_CREATED" | "INVITE_REVOKED" | "INVITE_ACCEPTED" | "INVITE_RESENT" | "MEMBER_ROLE_CHANGED" | "MEMBER_REMOVED" | "OWNERSHIP_TRANSFERRED" | "SITE_CREATED" | "SITE_DELETED" | "CHANNEL_INSTALLED" | "CHANNEL_REMOVED" | "PLAN_CHANGED" | "BRANDING_UPDATED" | "CHANGELOG_PUBLISHED" | "CHANGELOG_UPDATED" | "CHANGELOG_DELETED" | "SAML_CONFIG_UPDATED";

export type AuditTargetType = "TENANT" | "SITE" | "MEMBERSHIP" | "INVITE" | "CHANNEL" | "CHANGELOG";

export type ChangelogTag = "NEW" | "IMPROVED" | "FIX" | "BREAKING";

export type Kind = "DEBIT_HTTP" | "DEBIT_BROWSER" | "DEBIT_CHANGE_DETECT" | "GRANT_CYCLE" | "GRANT_TOPUP" | "GRANT_MIGRATION" | "GRANT_REFUND";

export type EmailDeliveryKind = "PASSWORD_RESET" | "ALERT" | "DIGEST" | "INVITE" | "OTHER";

export type EmailDeliveryStatus = "QUEUED" | "SENT" | "FAILED";

export type PostProcessingPhase = "NOT_STARTED" | "ENRICH_RESOURCES_DONE" | "SITEMAP_ALERTS_DONE" | "CRAWL_INDEX_DONE" | "ALERT_INBOUND_LINKS_DONE" | "POST_CRAWL_CHECKS_DONE" | "CROSS_CRAWL_DONE" | "ROBOTS_ALERT_DONE" | "FINALIZED";

export type Severity = "ERROR" | "WARNING" | "NOTICE";

export type ShareLinkScope = "SITE" | "CRAWL_REPORT" | "PAGE_DETAIL";

export type SiteCadence = "PAUSED" | "DAILY" | "HOURLY" | "CONTINUOUS";

export type SubscriptionStatus = "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "INCOMPLETE";

export type TlsCertStatus = "PROVISIONING" | "ACTIVE" | "RENEWING" | "FAILED";

export type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
