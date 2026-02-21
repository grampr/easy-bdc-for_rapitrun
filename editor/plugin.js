/**
 * EDBP Plugin System
 * Plugin management with GitHub discovery, trust levels, and uninstallation.
 */
const EDBB_CURRENT_APP_VERSION = '1.1.0';
const EDBB_PLUGIN_VERSION_PATTERN = /^(\d+)\.(\d+)\.([01])$/;
const EDBB_APP_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const EDBB_SUPPORTED_PLUGIN_RUNTIMES = new Set(['0', '1']);
const EDBB_GITHUB_MARKETPLACE_RATE_LIMIT_UNTIL_KEY = 'edbb_github_marketplace_rate_limited_until';

const parsePluginVersion = (versionText) => {
    const match = String(versionText || '').match(EDBB_PLUGIN_VERSION_PATTERN);
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        runtime: match[3]
    };
};

const parseAppVersion = (versionText) => {
    const match = String(versionText || '').match(EDBB_APP_VERSION_PATTERN);
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3])
    };
};

const EDBB_CURRENT_APP_VERSION_INFO = parseAppVersion(EDBB_CURRENT_APP_VERSION);
if (EDBB_CURRENT_APP_VERSION_INFO === null) {
    const msg = `Invalid EDBB_CURRENT_APP_VERSION: "${EDBB_CURRENT_APP_VERSION}". Expected format: major.minor.patch`;
    console.error(msg);
    throw new Error(msg);
}

export class PluginManager {
    /**
     * 繝ｪ繝医Λ繧､讖溯・莉倥″縺ｮfetch (繧ｿ繧､繝繧｢繧ｦ繝亥宛髯蝉ｻ倥″)
     */
    async fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
        const timeout = options.timeout || 5000;
        const fetchFn = this.nativeFetch || fetch;
        for (let i = 0; i < retries; i++) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetchFn(url, { ...options, signal: controller.signal });
                clearTimeout(id);
                if (response.ok) return response;
                // 繝ｬ繝ｼ繝亥宛髯・403)譎ゅ・繝ｪ繝医Λ繧､縺励※繧ら┌鬧・↑縺ｮ縺ｧ蜊ｳ蠎ｧ縺ｫ繧ｨ繝ｩ繝ｼ
                if (response.status === 403) {
                    throw new Error('GitHub API rate limit exceeded');
                }
                // 繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ(500莉･荳・縺ｮ縺ｿ繝ｪ繝医Λ繧､
                if (response.status >= 500) {
                    await new Promise(r => setTimeout(r, backoff * (i + 1)));
                    continue;
                }
                return response;
            } catch (err) {
                const errorText = String(err?.message || '').toLowerCase();
                if (errorText.includes('rate limit') || errorText.includes('403')) {
                    throw err;
                }
                if (i === retries - 1) throw err;
                await new Promise(r => setTimeout(r, backoff * (i + 1)));
            }
        }
        throw new Error('fetchWithRetry exhausted retries without a response');
    }

    constructor(workspace) {
        this.workspace = workspace;
        this.nativeFetch = (typeof window !== 'undefined' && typeof window.fetch === 'function')
            ? window.fetch.bind(window)
            : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        this.plugins = new Map();
        this.warnedDeprecatedLicenseKeys = new Set();
        this.externalDocDatasets = [
            {
                key: 'manifest',
                jsonUrl: 'https://raw.githubusercontent.com/EDBPlugin/not-cord/refs/heads/main/manifest.json',
                markdownUrl: 'https://raw.githubusercontent.com/EDBPlugin/ALL.md/refs/heads/main/manifest.md'
            },
            {
                key: 'readme',
                jsonUrl: 'https://raw.githubusercontent.com/EDBPlugin/not-cord/refs/heads/main/readme.json',
                markdownUrl: 'https://raw.githubusercontent.com/EDBPlugin/ALL.md/refs/heads/main/notreadme.md'
            }
        ];
        this.externalDocRepoOverrideMap = new Map();
        this.externalManifestRepoSet = new Set();
        this.externalDocRepoOverrideLoadPromise = null;
        this.marketplaceFallbackUrl = 'https://raw.githubusercontent.com/EDBPlugin/PBARL/refs/heads/main/edbp_data.json';
        this.marketplaceFallbackRawPromise = null;
        this.githubMarketplaceRateLimitedUntil = 0;
        this.githubMarketplaceRateLimitCooldownMs = 10 * 60 * 1000;
        this.githubMarketplaceFallbackLogShown = false;
        this.githubMarketplaceSearchPromise = null;
        this.githubApiCooldownNoticeShown = false;
        const persistedRateLimitUntil = Number(localStorage.getItem(EDBB_GITHUB_MARKETPLACE_RATE_LIMIT_UNTIL_KEY) || '0');
        if (Number.isFinite(persistedRateLimitUntil) && persistedRateLimitUntil > Date.now()) {
            this.githubMarketplaceRateLimitedUntil = persistedRateLimitUntil;
        }
        // 繧､繝ｳ繧ｹ繝医・繝ｫ貂医∩繝励Λ繧ｰ繧､繝ｳ縺ｮ繝｡繧ｿ繝・・繧ｿ
        this.installedPlugins = JSON.parse(localStorage.getItem('edbb_installed_plugins') || '{}');

        // 繝・・繧ｿ縺ｮ遘ｻ陦・ 譁・ｭ怜・縺九ｉ0(local)/1(github)縺ｸ
        let modified = false;
        Object.values(this.installedPlugins).forEach(p => {
            if (p.installedFrom === 'github') {
                p.installedFrom = 1;
                modified = true;
            } else if (p.installedFrom === 'local') {
                p.installedFrom = 0;
                modified = true;
            } else if (p.installedFrom === undefined) {
                // 譏守､ｺ縺輔ｌ縺ｦ縺・↑縺・ｴ蜷医・local(0)
                p.installedFrom = 0;
                modified = true;
            }
            if (p && Object.prototype.hasOwnProperty.call(p, 'license')) {
                this.warnDeprecatedLicense(p);
                delete p.license;
                modified = true;
            }
        });
        if (modified) {
            this.saveInstalledPlugins();
        }

        // 譛牙柑蛹悶＆繧後※縺・ｋ繝励Λ繧ｰ繧､繝ｳ縺ｮID
        this.enabledPlugins = new Set(JSON.parse(localStorage.getItem('edbb_enabled_plugins') || '[]'));

        // 蜈ｬ隱阪・繝ｩ繧ｰ繧､繝ｳ繝ｪ繧ｹ繝医・繧ｭ繝｣繝・す繝･
        this.certifiedPlugins = [];
        // 繝悶Λ繝・け繝ｪ繧ｹ繝医・繧ｭ繝｣繝・す繝･
        this.blacklistedPlugins = [];

        // 驕主悉縺ｮ雋蛯ｵ繧呈ｸ・ｮ・
        this._purgeLegacySystems();
    }

    _purgeLegacySystems() {
        const legacyBuiltinIds = ['vanilla-plugin'];
        const legacyBuiltinUUIDs = ['edbp-builtin-vanilla-001'];
        let purged = false;

        // 1. ID縺ｫ繧医ｋ繝代・繧ｸ
        legacyBuiltinIds.forEach(id => {
            if (this.installedPlugins[id]) {
                delete this.installedPlugins[id];
                purged = true;
            }
            if (this.enabledPlugins.has(id)) {
                this.enabledPlugins.delete(id);
                purged = true;
            }
        });

        // 2. UUID縺ｫ繧医ｋ繝代・繧ｸ
        Object.keys(this.installedPlugins).forEach(id => {
            const plugin = this.installedPlugins[id];
            if (plugin && legacyBuiltinUUIDs.includes(plugin.uuid)) {
                delete this.installedPlugins[id];
                this.enabledPlugins.delete(id);
                purged = true;
            }
        });

        if (purged) {
            console.log('Legacy systems purged from local database.');
            this.saveInstalledPlugins();
            this.saveState();
        }
    }

    /**
     * 縺吶∋縺ｦ縺ｮ繝励Λ繧ｰ繧､繝ｳ繝・・繧ｿ繧貞ｮ悟・縺ｫ蜑企勁縺励∝・譛溽憾諷九↓謌ｻ縺励∪縺吶・
     * 螻･豁ｴ豸亥悉縺ｪ縺ｩ縺ｮ謫堺ｽ懊→騾｣蜍輔＆縺帙ｋ縺溘ａ縺ｮ繧ｷ繧ｹ繝・Β縺ｧ縺吶・
     */
    resetSystem() {
        console.warn('EDBP System Reset initiated. Purging all local plugin data.');
        this.installedPlugins = {};
        this.enabledPlugins = new Set();
        this.plugins.forEach(p => {
            if (p && typeof p.onunload === 'function') p.onunload();
        });
        this.plugins.clear();

        // localStorage縺ｮ迚ｩ逅・炎髯､
        localStorage.removeItem('edbb_installed_plugins');
        localStorage.removeItem('edbb_enabled_plugins');

        console.log('All plugin data has been completely removed.');
    }


    async init() {
        console.log('PluginManager initializing...');

        // 蜈ｬ隱阪・繝ｩ繧ｰ繧､繝ｳ繝ｪ繧ｹ繝医ｒ蜑阪・蠖｢縺ｧ蜿門ｾ・(EDBP-API 縺ｮ plugins.json)
        try {
            const response = await this.fetchWithRetry('https://raw.githubusercontent.com/EDBPlugin/EDBP-API/main/plugins.json');
            if (response.ok) {
                this.certifiedPlugins = await response.json();
            }
        } catch (e) {
            console.warn('Failed to fetch certified plugins list', e);
        }

        // 繝悶Λ繝・け繝ｪ繧ｹ繝医ｒ蜿門ｾ・(EDBPlugin/Blacklist 縺ｮ plugins.json)
        try {
            const response = await this.fetchWithRetry('https://raw.githubusercontent.com/EDBPlugin/Blacklist/main/plugins.json');
            if (response.ok) {
                this.blacklistedPlugins = await response.json();
            }
        } catch (e) {
            console.warn('Failed to fetch blacklisted plugins list', e);
        }

        for (const pluginId of Array.from(this.enabledPlugins)) {
            // 繝・せ繝育畑繝励Λ繧ｰ繧､繝ｳ縺ｯ蜀崎ｪｭ縺ｿ霎ｼ縺ｿ譎ゅ↓閾ｪ蜍輔〒辟｡蜉ｹ蛹悶☆繧・
            if (pluginId === 'test-danger' || pluginId === 'malicious-test-plugin') {
                this.enabledPlugins.delete(pluginId);
                this.saveState();
                console.log('Test danger plugin auto-disabled on reload');
                continue;
            }
            try {
                await this.enablePlugin(pluginId);
            } catch (err) {
                console.error(`Failed to enable ${pluginId} during init`, err);
            }
        }
    }


    // GitHub縺九ｉ edbp-plugin 繝医ヴ繝・け縺ｮ莉倥＞縺溘Μ繝昴ず繝医Μ繧貞叙蠕・
    getDefaultBranchFromFallbackDataset(entry) {
        const refNames = Array.isArray(entry?.refs?.nodes)
            ? entry.refs.nodes
                .map((node) => String(node?.name || '').trim())
                .filter(Boolean)
            : [];

        if (refNames.includes('main')) return 'main';
        if (refNames.includes('master')) return 'master';
        if (refNames.length > 0) return refNames[0];
        return 'main';
    }

    mapFallbackEntryToMarketplaceItem(entry) {
        const fallbackFullName = String(entry?.nameWithOwner || '').trim();
        const fallbackUrl = String(entry?.url || '').trim();
        const parsedFromUrl = this.parseGitHubUrl(fallbackUrl);
        const fullName = fallbackFullName || parsedFromUrl?.fullName || '';
        if (!fullName || !fullName.includes('/')) return null;

        const [author, ...repoParts] = fullName.split('/');
        const repoName = repoParts.join('/');
        if (!author || !repoName) return null;

        const repoUrl = fallbackUrl || `https://github.com/${fullName}`;
        const trustLevel = this.getTrustLevel({
            full_name: fullName,
            html_url: repoUrl,
            owner: { login: author }
        });

        return {
            id: repoName,
            name: repoName,
            author: author,
            description: entry?.description || '',
            repo: repoUrl,
            stars: Number(entry?.stargazerCount || 0),
            trustLevel: trustLevel,
            tags: [],
            fullName: fullName,
            defaultBranch: this.getDefaultBranchFromFallbackDataset(entry)
        };
    }

    async fetchFallbackMarketplaceRaw() {
        if (this.marketplaceFallbackRawPromise) {
            return this.marketplaceFallbackRawPromise;
        }
        this.marketplaceFallbackRawPromise = (async () => {
            try {
                const response = await this.fetchWithRetry(this.marketplaceFallbackUrl, {}, 2, 300);
                if (!response.ok) return [];
                const payload = await response.json();
                return Array.isArray(payload) ? payload : [];
            } catch (e) {
                console.warn('Failed to fetch fallback marketplace dataset', e);
                return [];
            }
        })();
        return this.marketplaceFallbackRawPromise;
    }

    async getPBARLRefCandidates(fullName) {
        const normalizedFullName = String(fullName || '').trim().toLowerCase();
        if (!normalizedFullName) return [];

        const payload = await this.fetchFallbackMarketplaceRaw();
        const entry = payload.find((item) => String(item?.nameWithOwner || '').trim().toLowerCase() === normalizedFullName);
        if (!entry) return [];

        const refs = Array.isArray(entry?.refs?.nodes)
            ? entry.refs.nodes
                .map((node) => String(node?.name || '').trim())
                .filter(Boolean)
            : [];

        const uniqueRefs = [];
        refs.forEach((candidate) => {
            if (!uniqueRefs.includes(candidate)) uniqueRefs.push(candidate);
        });
        return uniqueRefs;
    }

    async getCommitShaFromPBARL(fullName, ref) {
        const normalizedFullName = String(fullName || '').trim().toLowerCase();
        const normalizedRef = String(ref || '').trim().toLowerCase();
        if (!normalizedFullName || !normalizedRef) return null;

        const payload = await this.fetchFallbackMarketplaceRaw();
        const entry = payload.find((item) => String(item?.nameWithOwner || '').trim().toLowerCase() === normalizedFullName);
        if (!entry || !Array.isArray(entry?.refs?.nodes)) return null;

        const matchedRef = entry.refs.nodes.find((node) => String(node?.name || '').trim().toLowerCase() === normalizedRef);
        const oid = String(matchedRef?.target?.oid || '').trim();
        return oid || null;
    }

    isGitHubRateLimitError(error) {
        const text = String(error?.message || '').toLowerCase();
        return text.includes('rate limit') || text.includes('403');
    }

    isGitHubApiCoolingDown() {
        return Date.now() < this.githubMarketplaceRateLimitedUntil;
    }

    markGitHubApiRateLimited() {
        this.githubMarketplaceRateLimitedUntil = Date.now() + this.githubMarketplaceRateLimitCooldownMs;
        localStorage.setItem(
            EDBB_GITHUB_MARKETPLACE_RATE_LIMIT_UNTIL_KEY,
            String(this.githubMarketplaceRateLimitedUntil)
        );
    }

    async fetchFallbackMarketplacePlugins() {
        const payload = await this.fetchFallbackMarketplaceRaw();
        return payload
            .map((entry) => this.mapFallbackEntryToMarketplaceItem(entry))
            .filter(Boolean)
            .sort((a, b) => Number(b?.stars || 0) - Number(a?.stars || 0));
    }

    async searchGitHubPlugins() {
        if (this.githubMarketplaceSearchPromise) {
            return await this.githubMarketplaceSearchPromise;
        }

        if (this.isGitHubApiCoolingDown()) {
            if (!this.githubMarketplaceFallbackLogShown) {
                console.warn('GitHub API is cooling down after rate limit. Using PBARL marketplace dataset.');
                this.githubMarketplaceFallbackLogShown = true;
            }
            return await this.fetchFallbackMarketplacePlugins();
        }
        if (this.githubMarketplaceRateLimitedUntil > 0) {
            this.githubMarketplaceRateLimitedUntil = 0;
            localStorage.removeItem(EDBB_GITHUB_MARKETPLACE_RATE_LIMIT_UNTIL_KEY);
        }

        this.githubMarketplaceSearchPromise = (async () => {
            try {
                const q = 'topic:edbp-plugin';
                const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc`;
                const response = await this.fetchWithRetry(url);

                if (!response.ok) {
                    if (response.status === 403) throw new Error('GitHub API Rate Limit Exceeded');
                    throw new Error(`GitHub API error: ${response.status}`);
                }

                let data = await response.json();
                if (!data || !Array.isArray(data.items)) {
                    return await this.fetchFallbackMarketplacePlugins();
                }

                const items = data.items.map(repo => {
                    const trustLevel = this.getTrustLevel(repo);
                    return {
                        id: repo.name,
                        name: repo.name,
                        author: repo.owner.login,
                        description: repo.description,
                        repo: repo.html_url,
                        stars: repo.stargazers_count,
                        trustLevel: trustLevel,
                        tags: Array.isArray(repo.topics) ? repo.topics : [],
                        fullName: repo.full_name,
                        defaultBranch: repo.default_branch
                    };
                });

                this.githubMarketplaceRateLimitedUntil = 0;
                this.githubMarketplaceFallbackLogShown = false;
                this.githubApiCooldownNoticeShown = false;
                localStorage.removeItem(EDBB_GITHUB_MARKETPLACE_RATE_LIMIT_UNTIL_KEY);
                return items;
            } catch (e) {
                if (this.isGitHubRateLimitError(e)) {
                    this.markGitHubApiRateLimited();
                }
                console.error('Failed to fetch GitHub plugins', e);
                const fallbackItems = await this.fetchFallbackMarketplacePlugins();
                if (fallbackItems.length > 0) {
                    console.warn('Using fallback marketplace dataset because GitHub API is unavailable or rate limited.');
                    this.githubMarketplaceFallbackLogShown = true;
                    return fallbackItems;
                }
                return [];
            } finally {
                this.githubMarketplaceSearchPromise = null;
            }
        })();

        return await this.githubMarketplaceSearchPromise;
    }
    // 菫｡鬆ｼ繝ｬ繝吶Ν縺ｮ蛻､螳・(GitHub Search Result逕ｨ)
    getTrustLevel(repo) {
        // 繝悶Λ繝・け繝ｪ繧ｹ繝医メ繧ｧ繝・け繧貞━蜈・
        const blacklistMatch = this._isInList(this.blacklistedPlugins, repo.full_name, repo.html_url);
        if (blacklistMatch) {
            return {
                level: 'danger',
                reason: typeof blacklistMatch === 'object' ? blacklistMatch.reason : null
            };
        }

        if (repo.owner.login === 'EDBPlugin') return { level: 'official' };

        // EDBP-API縺ｮ繝ｪ繧ｹ繝医↓蜷ｫ縺ｾ繧後※縺・ｋ縺九メ繧ｧ繝・け
        const isCertified = this._isInList(this.certifiedPlugins, repo.full_name, repo.html_url);
        if (isCertified) return { level: 'certified' };

        return null;
    }

    // 菫｡鬆ｼ繝ｬ繝吶Ν縺ｮ蛻､螳・(繧､繝ｳ繧ｹ繝医・繝ｫ貂医∩繝槭ル繝輔ぉ繧ｹ繝育畑)
    getManifestTrustLevel(manifest) {
        const validation = this.validateManifest(manifest);
        let level = null;
        let reason = null;

        // 繝悶Λ繝・け繝ｪ繧ｹ繝医メ繧ｧ繝・け
        if (manifest.repo) {
            const blacklistMatch = this._isInList(this.blacklistedPlugins, null, manifest.repo);
            if (blacklistMatch) {
                level = 'danger';
                reason = typeof blacklistMatch === 'object' ? blacklistMatch.reason : null;
            }
        }

        if (!level) {
            if (manifest.author === 'EDBPlugin') {
                level = 'official';
            } else if (manifest.repo) {
                const isCertified = this._isInList(this.certifiedPlugins, null, manifest.repo);
                if (isCertified) level = 'certified';
            }
        }

        return {
            level: level,
            reason: reason,
            invalid: !validation.valid,
            invalidReason: validation.valid ? null : `蠢・磯・岼縺御ｸ崎ｶｳ縺励※縺・∪縺・ ${validation.missing.join(', ')}`
        };
    }

    /**
     * 繝槭ル繝輔ぉ繧ｹ繝医・蠢・磯・岼繧偵メ繧ｧ繝・け縺励∪縺・
     * @param {object} manifest 
     * @returns {object} { valid: boolean, missing: string[] }
     */
    warnDeprecatedLicense(manifest) {
        const key = String(manifest?.uuid || manifest?.id || manifest?.name || 'unknown');
        if (this.warnedDeprecatedLicenseKeys.has(key)) return;
        this.warnedDeprecatedLicenseKeys.add(key);
        console.warn('manifest license field is deprecated and ignored.');
    }

    validateManifest(manifest) {
        const required = ['name', 'version', 'author', 'affectsStyle', 'affectsBlocks', 'minAppVersion'];
        const missing = [];

        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
            return {
                valid: false,
                missing: ['manifest (object)']
            };
        }

        required.forEach(field => {
            if (manifest[field] === undefined || manifest[field] === null || manifest[field] === '') {
                missing.push(field);
            }
        });

        if (manifest.affectsStyle !== undefined && typeof manifest.affectsStyle !== 'boolean') {
            missing.push('affectsStyle (boolean)');
        }

        if (manifest.affectsBlocks !== undefined && typeof manifest.affectsBlocks !== 'boolean') {
            missing.push('affectsBlocks (boolean)');
        }

        const minAppVersionText = String(manifest.minAppVersion || '');
        const parsedMinAppVersion = parsePluginVersion(minAppVersionText);

        if (manifest.minAppVersion !== undefined && manifest.minAppVersion !== null && manifest.minAppVersion !== '') {
            if (typeof manifest.minAppVersion !== 'string') {
                missing.push('minAppVersion (must be a string in major.minor.runtime, runtime is 0=JavaScript or 1=PHP)');
            } else if (!parsedMinAppVersion) {
                missing.push('minAppVersion (must be major.minor.runtime, runtime is 0=JavaScript or 1=PHP)');
            }
        }

        if (parsedMinAppVersion) {
            if (!EDBB_SUPPORTED_PLUGIN_RUNTIMES.has(parsedMinAppVersion.runtime)) {
                missing.push('minAppVersion runtime (must be 0=JavaScript or 1=PHP)');
            }

            if (
                EDBB_CURRENT_APP_VERSION_INFO.major < parsedMinAppVersion.major
                || (
                    EDBB_CURRENT_APP_VERSION_INFO.major === parsedMinAppVersion.major
                    && EDBB_CURRENT_APP_VERSION_INFO.minor < parsedMinAppVersion.minor
                )
            ) {
                missing.push(
                    `minAppVersion (current app version must be at least ${parsedMinAppVersion.major}.${parsedMinAppVersion.minor})`
                );
            }
        }

        const isNewVersion = parsedMinAppVersion && (
            parsedMinAppVersion.major > 1 || 
            (parsedMinAppVersion.major === 1 && parsedMinAppVersion.minor >= 1)
        );

        if (manifest.externalPackages !== undefined) {
            if (isNewVersion && parsedMinAppVersion.runtime === '0') {
                console.warn('externalPackages is deprecated for minAppVersion 1.1.0+. Use pipInstall instead.');
            }
            const isValidExternalPackages = Array.isArray(manifest.externalPackages)
                && manifest.externalPackages.every((pkg) => typeof pkg === 'string' && pkg.trim() !== '');
            if (!isValidExternalPackages) {
                missing.push('externalPackages (string[])');
            }
        }

        if (manifest.pipInstall !== undefined) {
            const isValidPipInstall = Array.isArray(manifest.pipInstall)
                && manifest.pipInstall.every((pkg) => typeof pkg === 'string' && pkg.trim() !== '' && !/\s/.test(pkg.trim()));
            if (!isValidPipInstall) {
                missing.push('pipInstall (string[]: package name only, no "pip install")');
            }
        }

        if (manifest.requiredPlugins !== undefined) {
            const isValidRequiredPlugins = Array.isArray(manifest.requiredPlugins)
                && manifest.requiredPlugins.every((pluginId) => typeof pluginId === 'string' && pluginId.trim() !== '');
            if (!isValidRequiredPlugins) {
                missing.push('requiredPlugins (string[])');
            }
        }

        if (manifest.api !== undefined) {
            const api = manifest.api;
            const isObject = api && typeof api === 'object' && !Array.isArray(api);
            const hasValidName = typeof api?.name === 'string' && api.name.trim() !== '';
            if (!isObject || !hasValidName) {
                missing.push('api (object with non-empty name)');
            } else if (api.baseUrl !== undefined) {
                const isValidBaseUrl = typeof api.baseUrl === 'string' && /^https?:\/\//i.test(api.baseUrl);
                if (!isValidBaseUrl) {
                    missing.push('api.baseUrl (optional, but must be a valid http/https URL string)');
                }
            }
        }

        if (Object.prototype.hasOwnProperty.call(manifest, 'license')) {
            this.warnDeprecatedLicense(manifest);
        }

        return {
            valid: missing.length === 0,
            missing: missing
        };
    }

    /**
     * 繝ｪ繧ｹ繝茨ｼ亥・隱阪・繝悶Λ繝・け繝ｪ繧ｹ繝茨ｼ峨↓蜷ｫ縺ｾ繧後※縺・ｋ縺九メ繧ｧ繝・け縺吶ｋ繝倥Ν繝代・
     * 隕九▽縺九▲縺溷ｴ蜷医・縺昴・繧ｨ繝ｳ繝医Μ繧偵∬ｦ九▽縺九ｉ縺ｪ縺・ｴ蜷医・null繧定ｿ斐＠縺ｾ縺吶・
     */
    _isInList(list, fullName, url) {
        if (!Array.isArray(list)) return null;
        return list.find(p => {
            if (typeof p === 'string') {
                return (fullName && p === fullName) || (url && url.includes(p));
            }
            // 繧ｪ繝悶ず繧ｧ繧ｯ繝亥ｽ｢蠑・(URL繝励Ο繝代ユ繧｣縺後≠繧句ｴ蜷・
            if (p && typeof p === 'object') {
                const targetUrl = p.URL || p.url || p.repo || p.id;
                return targetUrl && url && (url === targetUrl || url.includes(targetUrl));
            }
            return false;
        }) || null;
    }

    /**
     * GitHub縺ｮURL繧定ｧ｣譫舌＠縺ｦ縲∵園譛芽・√Μ繝昴ず繝医Μ縲√ヶ繝ｩ繝ｳ繝√√ヱ繧ｹ繧呈歓蜃ｺ縺励∪縺吶・
     * @param {string} url 
     * @returns {object|null}
     */
    parseGitHubUrl(url) {
        if (!url || typeof url !== 'string' || !url.includes('github.com')) return null;

        try {
            // 繧ｯ繧ｨ繝ｪ繝代Λ繝｡繝ｼ繧ｿ繧帝勁蜴ｻ縺励∵忰蟆ｾ縺ｮ繧ｹ繝ｩ繝・す繝･繧・.git 繧貞叙繧企勁縺・
            const cleanUrl = url.split('?')[0].replace(/\/$/, '').replace(/\.git$/, '');

            // github.com/ 莉･髯阪・驛ｨ蛻・ｒ蜿門ｾ・
            const pathParts = cleanUrl.split('github.com/')[1].split('/');
            if (pathParts.length < 2) return null;

            const owner = pathParts[0];
            const repo = pathParts[1];
            let branch = 'main';
            let path = '';

            // blob/branch/path or tree/branch/path 縺ｮ蠖｢蠑上ｒ繝√ぉ繝・け
            if (pathParts.length >= 4 && (pathParts[2] === 'tree' || pathParts[2] === 'blob')) {
                branch = pathParts[3];
                path = pathParts.slice(4).join('/');
            }

            return { owner, repo, branch, path, fullName: `${owner}/${repo}` };
        } catch (e) {
            console.warn('Failed to parse GitHub URL:', url, e);
            return null;
        }
    }

    // README縺ｮ蜿門ｾ・
    normalizeExternalUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim().split('#')[0].split('?')[0].replace(/\/$/, '');

        try {
            const parsed = new URL(trimmed);
            const host = parsed.hostname.toLowerCase();
            const parts = parsed.pathname.split('/').filter(Boolean);

            if (host === 'github.com' && parts.length >= 7 && parts[2] === 'raw' && parts[3] === 'refs' && parts[4] === 'heads') {
                const owner = parts[0];
                const repo = parts[1];
                const branch = parts[5];
                const filePath = parts.slice(6).join('/');
                return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
            }

            if (host === 'raw.githubusercontent.com' && parts.length >= 4) {
                const owner = parts[0];
                const repo = parts[1];
                const branch = parts[2];
                const filePath = parts.slice(3).join('/');
                return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
            }

            return parsed.toString().replace(/\/$/, '');
        } catch (e) {
            return trimmed;
        }
    }

    normalizeRepoUrl(url) {
        if (!url || typeof url !== 'string') return '';

        // owner/repo form
        const trimmed = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
        if (/^[^\/\s]+\/[^\/\s]+$/.test(trimmed)) {
            return `https://github.com/${trimmed}`.toLowerCase();
        }

        // https://github.com/owner/repo form
        if (!trimmed.includes('github.com')) return '';
        const info = this.parseGitHubUrl(trimmed);
        if (!info?.fullName) return '';
        return `https://github.com/${info.fullName}`.toLowerCase();
    }

    collectGitHubReposFromJson(value, bucket = new Set()) {
        if (typeof value === 'string') {
            const normalized = this.normalizeRepoUrl(value);
            if (normalized) bucket.add(normalized);
            return bucket;
        }

        if (Array.isArray(value)) {
            value.forEach((item) => this.collectGitHubReposFromJson(item, bucket));
            return bucket;
        }

        if (value && typeof value === 'object') {
            Object.values(value).forEach((item) => this.collectGitHubReposFromJson(item, bucket));
        }

        return bucket;
    }

    async ensureExternalRepoOverridesLoaded() {
        if (this.externalDocRepoOverrideLoadPromise) {
            return this.externalDocRepoOverrideLoadPromise;
        }

        this.externalDocRepoOverrideLoadPromise = (async () => {
            const repoCategoryMap = new Map();

            const tasks = this.externalDocDatasets.map(async (dataset) => {
                const jsonUrl = this.normalizeExternalUrl(dataset.jsonUrl);

                try {
                    const response = await this.fetchWithRetry(jsonUrl, {}, 2, 300);
                    if (!response?.ok) return;

                    const data = await response.json();
                    const repos = this.collectGitHubReposFromJson(data);
                    repos.forEach((repoUrl) => {
                        if (!repoCategoryMap.has(repoUrl)) repoCategoryMap.set(repoUrl, new Set());
                        repoCategoryMap.get(repoUrl).add(dataset.key);
                    });
                } catch (e) {
                    console.warn('Failed to build external repo override map', dataset.jsonUrl, e);
                }
            });

            await Promise.all(tasks);

            const markdownByKey = new Map(
                this.externalDocDatasets.map((dataset) => [dataset.key, this.normalizeExternalUrl(dataset.markdownUrl)])
            );

            repoCategoryMap.forEach((keys, repoUrl) => {
                if (keys.has('manifest')) {
                    this.externalManifestRepoSet.add(repoUrl);
                }

                const hasManifest = keys.has('manifest');
                const hasReadme = keys.has('readme');
                let targetMarkdown = null;

                if (hasReadme) {
                    targetMarkdown = markdownByKey.get('readme');
                } else if (hasManifest) {
                    targetMarkdown = markdownByKey.get('manifest');
                }

                if (targetMarkdown) {
                    this.externalDocRepoOverrideMap.set(repoUrl, targetMarkdown);
                }
            });
        })();

        return this.externalDocRepoOverrideLoadPromise;
    }

    async isInExternalManifestList(identifier) {
        await this.ensureExternalRepoOverridesLoaded();
        const normalizedRepo = this.normalizeRepoUrl(identifier);
        if (!normalizedRepo) return false;
        return this.externalManifestRepoSet.has(normalizedRepo);
    }

    async hasExternalDocOverride(identifier) {
        if (typeof identifier !== 'string') return false;

        await this.ensureExternalRepoOverridesLoaded();

        const normalizedRepo = this.normalizeRepoUrl(identifier);
        if (normalizedRepo && this.externalDocRepoOverrideMap.has(normalizedRepo)) {
            return true;
        }

        const normalizedIdentifier = this.normalizeExternalUrl(identifier);
        return this.externalDocDatasets.some(
            (dataset) => this.normalizeExternalUrl(dataset.jsonUrl) === normalizedIdentifier
        );
    }

    async fetchTextOrNull(url) {
        try {
            const response = await this.fetchWithRetry(url, {}, 2, 300);
            if (!response?.ok) return null;
            return await response.text();
        } catch (e) {
            return null;
        }
    }

    async getREADME(identifier, defaultBranch = 'main') {
        if (typeof identifier === 'string') {
            // Always build raw override map first; if matched, do not fetch repo README.
            await this.ensureExternalRepoOverridesLoaded();
            const normalizedRepo = this.normalizeRepoUrl(identifier);
            if (normalizedRepo && this.externalDocRepoOverrideMap.has(normalizedRepo)) {
                const markdown = await this.fetchTextOrNull(this.externalDocRepoOverrideMap.get(normalizedRepo));
                if (markdown !== null) return markdown;
            }

            const normalizedIdentifier = this.normalizeExternalUrl(identifier);
            const directDataset = this.externalDocDatasets.find((dataset) => this.normalizeExternalUrl(dataset.jsonUrl) === normalizedIdentifier);
            if (directDataset) {
                const markdown = await this.fetchTextOrNull(this.normalizeExternalUrl(directDataset.markdownUrl));
                if (markdown !== null) return markdown;
            }

            if (/^https?:\/\/.+\.md$/i.test(identifier.trim())) {
                const markdown = await this.fetchTextOrNull(identifier.trim());
                if (markdown !== null) return markdown;
            }
        }

        const repoInfo = this.parseGitHubUrl(identifier);

        let fullName = identifier;
        let branch = defaultBranch;
        let subPath = '';

        if (repoInfo) {
            fullName = repoInfo.fullName;
            // URL縺ｫ繝悶Λ繝ｳ繝∵欠螳壹′縺ゅｌ縺ｰ縺昴ｌ繧剃ｽｿ逕ｨ縲√↑縺代ｌ縺ｰ蠑墓焚縺ｮ繝・ヵ繧ｩ繝ｫ繝・
            branch = (repoInfo.branch && repoInfo.branch !== 'main') ? repoInfo.branch : defaultBranch;
            subPath = repoInfo.path ? repoInfo.path + '/' : '';
        }

        // 讀懃ｴ｢縺吶ｋ繝代せ縺ｮ蜆ｪ蜈磯・ｽ・ URL蜀・・繝代せ/README.md -> 繝ｫ繝ｼ繝・README.md
        const possiblePaths = [
            `${subPath}README.md`,
            'README.md'
        ];

        // 驥崎､・ｒ髯､蜴ｻ
        const uniquePaths = [...new Set(possiblePaths)];

        for (const path of uniquePaths) {
            try {
                const url = `https://raw.githubusercontent.com/${fullName}/${branch}/${path}`;
                const response = await this.fetchWithRetry(url, {}, 2, 300);
                if (response.ok) return await response.text();
            } catch (e) { }
        }
        return 'README not found.';
    }


    // GitHub縺ｮ繝ｪ繝ｪ繝ｼ繧ｹ荳隕ｧ繧貞叙蠕・
    async getReleases(fullName) {
        if (this.isGitHubApiCoolingDown()) return [];
        try {
            const response = await this.fetchWithRetry(`https://api.github.com/repos/${fullName}/releases`, {}, 2, 300);
            if (!response.ok) return [];
            return await response.json();
        } catch (e) {
            if (this.isGitHubRateLimitError(e)) {
                this.markGitHubApiRateLimited();
                if (!this.githubApiCooldownNoticeShown) {
                    console.warn('GitHub API rate limited. Skipping release/branch/commit lookups temporarily.');
                    this.githubApiCooldownNoticeShown = true;
                }
                return [];
            }
            console.error('Failed to fetch releases', e);
            return [];
        }
    }

    async getBranches(fullName) {
        if (this.isGitHubApiCoolingDown()) return [];
        try {
            const response = await this.fetchWithRetry(`https://api.github.com/repos/${fullName}/branches?per_page=100`, {}, 2, 300);
            if (!response.ok) return [];
            const payload = await response.json();
            if (!Array.isArray(payload)) return [];
            return payload
                .map((item) => String(item?.name || '').trim())
                .filter(Boolean);
        } catch (e) {
            if (this.isGitHubRateLimitError(e)) {
                this.markGitHubApiRateLimited();
                if (!this.githubApiCooldownNoticeShown) {
                    console.warn('GitHub API rate limited. Skipping release/branch/commit lookups temporarily.');
                    this.githubApiCooldownNoticeShown = true;
                }
                return [];
            }
            console.error('Failed to fetch branches', e);
            return [];
        }
    }

    async getLatestCommitSha(fullName, ref = 'main') {
        if (this.isGitHubApiCoolingDown()) return null;
        try {
            const response = await this.fetchWithRetry(
                `https://api.github.com/repos/${fullName}/commits/${encodeURIComponent(ref)}`,
                {
                    headers: { Accept: 'application/vnd.github+json' }
                },
                2,
                300
            );
            if (!response.ok) return null;
            const payload = await response.json();
            const sha = String(payload?.sha || '').trim();
            return sha || null;
        } catch (e) {
            if (this.isGitHubRateLimitError(e)) {
                this.markGitHubApiRateLimited();
                if (!this.githubApiCooldownNoticeShown) {
                    console.warn('GitHub API rate limited. Skipping release/branch/commit lookups temporarily.');
                    this.githubApiCooldownNoticeShown = true;
                }
                return null;
            }
            console.warn('Failed to fetch latest commit sha', fullName, ref, e);
            return null;
        }
    }

    /**
     * GitHub縺九ｉmanifest.json繧貞叙蠕励＠縺ｦ繧ｪ繝悶ず繧ｧ繧ｯ繝医→縺励※霑斐＠縺ｾ縺・
     * API縺ｧ縺ｯ縺ｪ縺・raw 繧剃ｽｿ逕ｨ縺吶ｋ縺薙→縺ｧ縲√・繝ｼ繧ｱ繝・ヨ繝励Ξ繧､繧ｹ陦ｨ遉ｺ譎ゅ・API繝ｬ繝ｼ繝亥宛髯舌ｒ蝗樣∩縺励∪縺吶・
     */
    async getManifestFromGitHub(fullName, ref = 'main') {
        const refsToTry = [];
        const pushRef = (candidate) => {
            const value = String(candidate || '').trim();
            if (!value) return;
            if (!refsToTry.includes(value)) refsToTry.push(value);
        };

        pushRef(ref);
        const pbarlRefs = await this.getPBARLRefCandidates(fullName);
        pbarlRefs.forEach(pushRef);
        pushRef('main');
        pushRef('master');

        for (const candidateRef of refsToTry) {
            const json = await this.getRemoteFile(fullName, 'manifest.json', candidateRef);
            if (!json) continue;
            try {
                return JSON.parse(json);
            } catch (e) {
                console.warn(`Invalid manifest.json in ${fullName}@${candidateRef}`, e);
            }
        }
        return null;
    }

    /**
     * GitHub縺九ｉ莉ｻ諢上・繝ｪ繝昴ず繝医Μ縺ｮ繝輔ぃ繧､繝ｫ繧貞叙蠕励＠縺ｾ縺・(raw 逕ｨ)
     */
    async getRemoteFile(fullName, fileName, ref = 'main') {
        try {
            const url = `https://raw.githubusercontent.com/${fullName}/${encodeURIComponent(ref)}/${fileName}`;
            const response = await this.fetchWithRetry(url);
            if (!response.ok) {
                // master 縺ｸ縺ｮ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
                if (ref === 'main') {
                    const fallbackUrl = `https://raw.githubusercontent.com/${fullName}/master/${fileName}`;
                    const fallbackResponse = await this.fetchWithRetry(fallbackUrl);
                    if (fallbackResponse.ok) return await fallbackResponse.text();
                }
                return null;
            }
            return await response.text();
        } catch (e) {
            console.warn(`Failed to fetch ${fileName} from GitHub (${fullName})`, e);
            return null;
        }
    }

    /**
     * 蜈ｬ隱阪♀繧医・繝槭・繧ｱ繝・ヨ繝励Ξ繧､繧ｹ縺ｮ蜈ｨ繝励Λ繧ｰ繧､繝ｳ繝ｪ繧ｹ繝医ｒ霑斐＠縺ｾ縺・(蜊倥↑繧区枚蟄怜・縺ｮ驟榊・ ["author/repo", ...])
     */
    async getMarketplacePlugins() {
        const results = new Set(this.certifiedPlugins || []);

        try {
            const livePlugins = await this.searchGitHubPlugins();
            livePlugins.forEach(p => {
                if (p.fullName) results.add(p.fullName);
            });
        } catch (e) {
            console.warn("Live marketplace search failed, using certified list only.");
        }

        return Array.from(results);
    }

    // GitHub縺九ｉ逶ｴ謗･繧､繝ｳ繧ｹ繝医・繝ｫ
    async installFromGitHub(fullName, branchOrUrl = 'main') {
        try {
            const installInput = String(branchOrUrl || 'main').trim() || 'main';
            const parseRefFromInput = (value) => {
                if (!value || !value.startsWith('http')) return (value || 'main').replace(/\.zip$/, '');
                const normalizedUrl = value.split('?')[0];

                const zipballMatch = normalizedUrl.match(/\/zipball\/(.+)$/);
                if (zipballMatch) return decodeURIComponent(zipballMatch[1]);

                const githubArchiveMatch = normalizedUrl.match(/\/archive\/refs\/(?:heads|tags)\/(.+)\.zip$/);
                if (githubArchiveMatch) return decodeURIComponent(githubArchiveMatch[1]);

                const codeloadArchiveMatch = normalizedUrl.match(/\/zip\/refs\/(?:heads|tags)\/(.+)$/);
                if (codeloadArchiveMatch) return decodeURIComponent(codeloadArchiveMatch[1]);

                const releaseAssetMatch = normalizedUrl.match(/\/releases\/download\/([^\/]+)\//);
                if (releaseAssetMatch) return decodeURIComponent(releaseAssetMatch[1]);

                // 繝ｪ繝昴ず繝医ΜURL閾ｪ菴薙′貂｡縺輔ｌ縺溷ｴ蜷医・縲√◎縺ｮ繝悶Λ繝ｳ繝√ｒ謚ｽ蜃ｺ
                const repoInfo = this.parseGitHubUrl(value);
                if (repoInfo && repoInfo.branch) return repoInfo.branch;

                return null;
            };

            const ref = parseRefFromInput(installInput);
            if (!ref) {
                throw new Error('Unsupported ZIP URL in browser. Choose Source code (zip) or install from local ZIP.');
            }

            const inferInstallChannel = async () => {
                const isUrlInput = installInput.startsWith('http');
                const normalizedUrl = isUrlInput ? installInput.split('?')[0] : '';

                if (isUrlInput) {
                    if (/\/releases\/download\/[^\/]+\//.test(normalizedUrl)) return 'release';
                    if (/\/archive\/refs\/tags\/.+\.zip$/.test(normalizedUrl) || /\/zip\/refs\/tags\/.+$/.test(normalizedUrl)) return 'release';
                    if (/\/archive\/refs\/heads\/.+\.zip$/.test(normalizedUrl) || /\/zip\/refs\/heads\/.+$/.test(normalizedUrl)) return 'branch';
                    const repoInfo = this.parseGitHubUrl(installInput);
                    if (repoInfo?.branch && repoInfo.branch !== 'main') return 'branch';
                }

                const releases = await this.getReleases(fullName);
                const releaseTagSet = new Set(
                    Array.isArray(releases)
                        ? releases
                            .filter((release) => !release?.draft && release?.tag_name)
                            .map((release) => String(release.tag_name))
                        : []
                );
                return releaseTagSet.has(ref) ? 'release' : 'branch';
            };
            const installChannel = await inferInstallChannel();

            const decodeBase64Utf8 = (encoded) => {
                const binary = atob(encoded.replace(/\n/g, ''));
                const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
                return new TextDecoder('utf-8').decode(bytes);
            };

            const fetchRepoFile = async (filePath) => {
                const apiUrl = `https://api.github.com/repos/${fullName}/contents/${filePath}?ref=${encodeURIComponent(ref)}`;
                try {
                    const response = await this.fetchWithRetry(apiUrl, {
                        headers: { Accept: 'application/vnd.github+json' }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.type === 'file' && data.content) {
                            return decodeBase64Utf8(data.content);
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to fetch file ${filePath} from GitHub`, e);
                }
                return await this.getRemoteFile(fullName, filePath, ref);
            };

            const manifestText = await fetchRepoFile('manifest.json');
            if (!manifestText) throw new Error('manifest.json not found at repository root for selected ref');

            const manifest = JSON.parse(manifestText);

            // 繝舌Μ繝・・繧ｷ繝ｧ繝ｳ繝√ぉ繝・け (譁ｰ隕剰ｿｽ蜉)
            const validation = this.validateManifest(manifest);
            if (!validation.valid) {
                throw new Error(`繝槭ル繝輔ぉ繧ｹ繝医・蠢・磯・岼縺御ｸ崎ｶｳ縺励※縺・∪縺・ ${validation.missing.join(', ')}`);
            }

            if (!manifest.uuid) {
                manifest.uuid = this.generateUUID(manifest.author, manifest.name);
            }

            const id = manifest.id || manifest.name.toLowerCase().replace(/\s+/g, '-');
            manifest.id = id;
            manifest.updateDate = new Date().toISOString().split('T')[0];

            const scriptText = await fetchRepoFile('plugin.js');
            if (scriptText) {
                manifest.script = scriptText;
            }
            this.validatePluginScriptCapabilities(manifest);

            manifest.installedFrom = 1; // 1: github
            manifest.installRef = ref; // 繧､繝ｳ繧ｹ繝医・繝ｫ譎ゅ・繝悶Λ繝ｳ繝・繧ｿ繧ｰ/URL繧定ｨ倬鹸
            manifest.installChannel = installChannel; // branch | release
            const installCommitSha = await this.getLatestCommitSha(fullName, ref) || await this.getCommitShaFromPBARL(fullName, ref);
            if (installChannel === 'release') {
                manifest.installReleaseTag = ref;
                delete manifest.installBranch;
                if (installCommitSha) {
                    manifest.installCommitSha = installCommitSha;
                } else {
                    delete manifest.installCommitSha;
                }
            } else {
                manifest.installBranch = ref;
                if (installCommitSha) {
                    manifest.installCommitSha = installCommitSha;
                } else {
                    delete manifest.installCommitSha;
                }
                delete manifest.installReleaseTag;
            }

            // manifest.repo 繧貞ｮ滄圀縺ｮ繧､繝ｳ繧ｹ繝医・繝ｫ蜈ザRL縺ｫ蠑ｷ蛻ｶ逧・↓譖ｸ縺肴鋤縺医ｋ
            const repoUrl = `https://github.com/${fullName}`;
            if (manifest.repo !== repoUrl) {
                manifest.repo = repoUrl;
            }

            manifest.trustLevel = this.getManifestTrustLevel(manifest);

            this.installedPlugins[id] = manifest;
            this.saveInstalledPlugins();
            return manifest;
        } catch (error) {
            console.error("GitHub installation failed:", error);
            throw error;
        }
    }
    async uninstallPlugin(id) {
        await this.disablePlugin(id);
        delete this.installedPlugins[id];
        this.saveInstalledPlugins();
    }


    generateUUID(author, name) {
        const seed = `${author}-${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        return `edbp-${hex}-${Math.random().toString(36).substr(2, 4)}`;
    }

    async installFromZip(file) {
        try {
            const zip = await JSZip.loadAsync(file);
            const manifestFile = zip.file("manifest.json");
            if (!manifestFile) throw new Error('manifest.json not found.');

            const manifestText = await manifestFile.async("string");
            const manifest = JSON.parse(manifestText);

            // 繝舌Μ繝・・繧ｷ繝ｧ繝ｳ繝√ぉ繝・け (譁ｰ隕剰ｿｽ蜉)
            const validation = this.validateManifest(manifest);
            if (!validation.valid) {
                throw new Error(`繝槭ル繝輔ぉ繧ｹ繝医・蠢・磯・岼縺御ｸ崎ｶｳ縺励※縺・∪縺・ ${validation.missing.join(', ')}`);
            }

            if (!manifest.name || !manifest.author) {
                throw new Error('Manifest is missing required name or author.');
            }

            if (!manifest.uuid) {
                manifest.uuid = this.generateUUID(manifest.author, manifest.name);
            }

            const id = manifest.id || manifest.name.toLowerCase().replace(/\s+/g, '-');
            manifest.id = id;
            manifest.updateDate = new Date().toISOString().split('T')[0];

            const scriptFile = zip.file("plugin.js");
            if (scriptFile) {
                manifest.script = await scriptFile.async("string");
            }
            this.validatePluginScriptCapabilities(manifest);

            manifest.installedFrom = 0; // 0: local
            manifest.trustLevel = this.getManifestTrustLevel(manifest);

            this.installedPlugins[id] = manifest;
            this.saveInstalledPlugins();

            return manifest;
        } catch (error) {
            console.error("Plugin installation failed:", error);
            throw error;
        }
    }

    assertRequiredPluginsReady(pluginId, pluginMeta) {
        const requiredPlugins = Array.isArray(pluginMeta?.requiredPlugins) ? pluginMeta.requiredPlugins : [];
        if (!requiredPlugins.length) return;

        const missing = requiredPlugins.filter((requiredId) => !this.installedPlugins[requiredId]);
        if (missing.length) {
            throw new Error(`Required plugins are not installed: ${missing.join(', ')}`);
        }

        const disabled = requiredPlugins.filter((requiredId) => !this.enabledPlugins.has(requiredId));
        if (disabled.length) {
            throw new Error(`Required plugins are not enabled: ${disabled.join(', ')}`);
        }

        if (requiredPlugins.includes(pluginId)) {
            throw new Error('requiredPlugins must not include itself');
        }
    }

    createPluginCapabilityGuard(pluginMeta) {
        const restoreStack = [];
        const win = (typeof window !== 'undefined') ? window : globalThis;
        const workspace = this.workspace;

        if (!pluginMeta?.api) {
            if (typeof win.fetch === 'function') {
                const originalFetch = win.fetch.bind(win);
                win.fetch = (...args) => {
                    throw new Error('This plugin is not allowed to call external APIs (missing "api" in manifest).');
                };
                restoreStack.push(() => { win.fetch = originalFetch; });
            }

            if (win.XMLHttpRequest && win.XMLHttpRequest.prototype) {
                const xhrProto = win.XMLHttpRequest.prototype;
                const originalXhrOpen = xhrProto.open;
                xhrProto.open = function (...args) {
                    throw new Error('This plugin is not allowed to call external APIs (missing "api" in manifest).');
                };
                restoreStack.push(() => { xhrProto.open = originalXhrOpen; });
            }

            if (typeof win.WebSocket === 'function') {
                const originalWebSocket = win.WebSocket;
                win.WebSocket = function () {
                    throw new Error('This plugin is not allowed to open WebSocket connections (missing "api" in manifest).');
                };
                restoreStack.push(() => { win.WebSocket = originalWebSocket; });
            }
        }

        if (!pluginMeta?.affectsStyle && win.document) {
            const documentRef = win.document;
            const originalCreateElement = documentRef.createElement.bind(documentRef);
            documentRef.createElement = (tagName, ...rest) => {
                const lower = String(tagName || '').toLowerCase();
                if (lower === 'style' || lower === 'link') {
                    throw new Error('This plugin is not allowed to modify styles/UI (affectsStyle=false).');
                }
                return originalCreateElement(tagName, ...rest);
            };
            restoreStack.push(() => { documentRef.createElement = originalCreateElement; });

            if (win.Element && win.Element.prototype) {
                const elementProto = win.Element.prototype;
                const originalSetAttribute = elementProto.setAttribute;
                elementProto.setAttribute = function (name, value) {
                    if (String(name || '').toLowerCase() === 'style') {
                        throw new Error('This plugin is not allowed to modify styles/UI (affectsStyle=false).');
                    }
                    return originalSetAttribute.call(this, name, value);
                };
                restoreStack.push(() => { elementProto.setAttribute = originalSetAttribute; });
            }
        }

        if (!pluginMeta?.affectsBlocks && workspace && typeof workspace.updateToolbox === 'function') {
            const originalUpdateToolbox = workspace.updateToolbox.bind(workspace);
            workspace.updateToolbox = (...args) => {
                throw new Error('This plugin is not allowed to modify Blockly blocks/toolbox (affectsBlocks=false).');
            };
            restoreStack.push(() => { workspace.updateToolbox = originalUpdateToolbox; });
        }

        return () => {
            while (restoreStack.length) {
                const restore = restoreStack.pop();
                try {
                    restore();
                } catch (error) {
                    console.warn('Failed to restore plugin capability guard', error);
                }
            }
        };
    }

    validatePluginScriptCapabilities(pluginMeta) {
        const script = String(pluginMeta?.script || '');
        if (!script.trim()) return;

        if (!pluginMeta?.affectsStyle) {
            const stylePattern = /\bcreateElement\s*\(\s*['"`](style|link)['"`]|\bsetAttribute\s*\(\s*['"`]style['"`]|\.\s*style\s*\./i;
            if (stylePattern.test(script)) {
                throw new Error('This plugin script uses style/UI modification APIs but affectsStyle=false.');
            }
        }

        if (!pluginMeta?.affectsBlocks) {
            const blockPattern = /\bBlockly\.Blocks\b|\bupdateToolbox\s*\(/;
            if (blockPattern.test(script)) {
                throw new Error('This plugin script uses Blockly mutation APIs but affectsBlocks=false.');
            }
        }

        if (!pluginMeta?.api) {
            const apiPattern = /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b/;
            if (apiPattern.test(script)) {
                throw new Error('This plugin script uses external API/network features but "api" is not declared.');
            }
        }
    }

    async enablePlugin(id) {
        if (this.plugins.has(id)) return;

        const pluginMeta = this.installedPlugins[id];
        if (!pluginMeta) return;
        this.assertRequiredPluginsReady(id, pluginMeta);
        this.validatePluginScriptCapabilities(pluginMeta);
        const beforeBlockTypes = new Set(
            Object.keys((typeof Blockly !== 'undefined' && Blockly?.Blocks) ? Blockly.Blocks : {})
        );
        const restoreGuard = this.createPluginCapabilityGuard(pluginMeta);

        try {
            if (pluginMeta.script) {
                const pluginClass = new Function('workspace', `
                    try {
                        ${pluginMeta.script}
                        if (typeof Plugin === 'undefined') {
                            throw new Error('Plugin class not defined in script');
                        }
                        return new Plugin(workspace);
                    } catch (e) {
                        console.error('Error executing plugin script:', e);
                        throw e;
                    }
                `)(this.workspace);

                if (pluginClass && typeof pluginClass.onload === 'function') {
                    await pluginClass.onload();
                }
                this.plugins.set(id, pluginClass);
            } else if (pluginMeta.affectsStyle) {
                this.plugins.set(id, { onunload: () => { } });
            }
            restoreGuard();

            const afterBlockTypes = Object.keys(
                (typeof Blockly !== 'undefined' && Blockly?.Blocks) ? Blockly.Blocks : {}
            );
            const detectedTypes = afterBlockTypes.filter((type) => !beforeBlockTypes.has(type));
            if (!pluginMeta.affectsBlocks && detectedTypes.length > 0) {
                const blocklyRef = (typeof Blockly !== 'undefined') ? Blockly : null;
                detectedTypes.forEach((type) => {
                    if (blocklyRef?.Blocks?.[type]) {
                        delete blocklyRef.Blocks[type];
                    }
                });
                throw new Error('This plugin added Blockly blocks while affectsBlocks=false.');
            }
            const existingTypes = Array.isArray(pluginMeta.blockTypes) ? pluginMeta.blockTypes : [];
            const mergedTypes = Array.from(new Set([...existingTypes, ...detectedTypes]));
            if (mergedTypes.length > 0) {
                pluginMeta.blockTypes = mergedTypes;
                this.saveInstalledPlugins();
            }

            this.enabledPlugins.add(id);
            this.saveState();
        } catch (e) {
            restoreGuard();
            console.error(`Failed to enable plugin ${id}:`, e);
            throw e;
        }

    }

    async disablePlugin(id) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            if (typeof plugin.onunload === 'function') {
                await plugin.onunload();
            }
            this.plugins.delete(id);
        }
        this.enabledPlugins.delete(id);
        this.saveState();
    }

    saveState() {
        localStorage.setItem('edbb_enabled_plugins', JSON.stringify(Array.from(this.enabledPlugins)));
    }

    saveInstalledPlugins() {
        localStorage.setItem('edbb_installed_plugins', JSON.stringify(this.installedPlugins));
    }

    getRegistry() {
        return Object.values(this.installedPlugins).map(plugin => {
            // 繧､繝ｳ繧ｹ繝医・繝ｫ貂医∩繝・・繧ｿ縺九ｉ菫｡鬆ｼ繝ｬ繝吶Ν繧貞・險育ｮ励＠縺ｦ莉倅ｸ趣ｼ医Μ繧ｹ繝域峩譁ｰ蜿肴丐縺ｮ縺溘ａ・・
            return {
                ...plugin,
                trustLevel: this.getManifestTrustLevel(plugin)
            };
        });
    }

    // 繝励Λ繧ｰ繧､繝ｳ繧､繝ｳ繧ｹ繝医・繝ｫ逕ｨ縺ｮURL繧堤函謌・
    getPluginBlockTypes(id) {
        const plugin = this.installedPlugins[id];
        return Array.isArray(plugin?.blockTypes) ? plugin.blockTypes : [];
    }

    getInstallUrl(id) {
        const meta = this.installedPlugins[id];
        if (!meta || meta.installedFrom !== 1 || !meta.repo) return null;

        const repoInfo = this.parseGitHubUrl(meta.repo);
        if (!repoInfo) return null;

        const baseUrl = window.location.origin + window.location.pathname;
        let installQuery = repoInfo.fullName;
        if (meta.installRef && meta.installRef !== 'main') {
            installQuery += `@${meta.installRef}`;
        }
        return `${baseUrl}?install-plugin=${encodeURIComponent(installQuery)}`;
    }

    isPluginEnabled(id) {
        return this.enabledPlugins.has(id);
    }

    getPluginUUIDsForShare() {
        const uuids = [];
        for (const id of this.enabledPlugins) {
            if (this.isPluginSharable(id)) {
                const meta = this.installedPlugins[id];
                if (meta) {
                    uuids.push(meta.uuid);
                }
            }
        }
        return uuids;
    }

    // 蜈ｱ譛峨＆繧後◆髫帙↓縲√Ξ繧ｷ繝斐お繝ｳ繝亥・縺ｧ繧､繝ｳ繧ｹ繝医・繝ｫ繧剃ｿ・☆縺溘ａ縺ｮ諠・ｱ繧貞叙蠕・
    getSharablePluginsInfo() {
        const infos = [];
        for (const id of this.enabledPlugins) {
            if (this.isPluginSharable(id)) {
                const meta = this.installedPlugins[id];
                if (meta.repo) {
                    infos.push(meta.repo);
                }
            }
        }
        return infos;
    }

    // 譛ｪ繧､繝ｳ繧ｹ繝医・繝ｫ縺ｮ蜈ｱ譛峨・繝ｩ繧ｰ繧､繝ｳ縺後≠繧句ｴ蜷医↓蜻ｼ縺ｳ蜃ｺ縺吶さ繝ｼ繝ｫ繝舌ャ繧ｯ繧堤匳骭ｲ
    onPluginsSuggested(callback) {
        this.suggestCallback = callback;
    }

    suggestPlugins(pluginEntries) {
        if (typeof this.suggestCallback === 'function' && pluginEntries && pluginEntries.length > 0) {
            this.suggestCallback(pluginEntries);
        }
    }

    hasNonSharablePlugin() {
        for (const id of this.enabledPlugins) {
            if (!this.isPluginSharable(id)) {
                return true;
            }
        }
        return false;
    }

    getPluginIdByUUID(uuid) {
        for (const [id, meta] of Object.entries(this.installedPlugins)) {
            if (meta.uuid === uuid) return id;
        }
        return null;
    }

    // 繝励Λ繧ｰ繧､繝ｳ縺悟・譛牙庄閭ｽ縺句愛譁ｭ縺吶ｋ繝ｭ繧ｸ繝・け
    isPluginSharable(id) {
        const meta = this.installedPlugins[id];
        if (!meta) return false;

        // GitHub縺九ｉ繧､繝ｳ繧ｹ繝医・繝ｫ縺輔ｌ縺溘ｂ縺ｮ縺ｯ縲√Μ繝昴ず繝医ΜURL縺後≠繧九◆繧∝・譛牙庄閭ｽ (installedFrom: 1)

        if (meta.installedFrom === 1 && meta.repo) return true;

        // 繝ｭ繝ｼ繧ｫ繝ｫZIP縺九ｉ縺ｮ繧ゅ・縺ｯ縲∽ｻ紋ｺｺ縺梧戟縺｣縺ｦ縺・↑縺・庄閭ｽ諤ｧ縺後≠繧九◆繧∝渕譛ｬ縺ｯ蜈ｱ譛我ｸ榊庄
        // (蟆・擂逧・↓ZIP縺斐→繝励Ο繧ｸ繧ｧ繧ｯ繝医↓蝓九ａ霎ｼ繧縺ｪ繧牙庄閭ｽ縺ｫ縺ｪ繧九°繧ゅ＠繧後↑縺・′縲∫樟蝨ｨ縺ｯUUID縺ｮ縺ｿ蜈ｱ譛峨☆繧九◆繧・
        return false;
    }

    // 繝励Λ繧ｰ繧､繝ｳ繧短IP縺ｨ縺励※繧ｨ繧ｯ繧ｹ繝昴・繝・
    async exportPluginAsZip(id) {
        const meta = this.installedPlugins[id];
        if (!meta) throw new Error('Plugin not found.');

        const zip = new JSZip();
        const manifest = { ...meta };
        const script = manifest.script;

        // manifest.json 縺ｯ繧ｨ繧ｯ繧ｹ繝昴・繝域凾縺ｫ荳崎ｦ√↑諠・ｱ繧貞炎繧・
        delete manifest.script;
        delete manifest.installedFrom;

        zip.file("manifest.json", JSON.stringify(manifest, null, 2));
        if (script) {
            zip.file("plugin.js", script);
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (manifest.id || manifest.name || 'plugin').replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `${safeName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
