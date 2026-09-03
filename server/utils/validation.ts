export function isValidGoogleMapsUrl(url: any): boolean {
    if (!url) return true; // Optional field
    if (typeof url !== 'string') return false;
    if (url.length > 500) return false;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const validDomains = ['maps.google.com', 'www.google.com', 'goo.gl', 'maps.app.goo.gl'];
        return validDomains.includes(parsed.hostname);
    } catch {
        return false;
    }
}
