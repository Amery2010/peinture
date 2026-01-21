
import { S3Config, CloudFile, WebDAVConfig, StorageType } from "../types";
// @ts-ignore
import { dir, file, write } from 'opfs-tools';

const S3_CONFIG_KEY = 'app_s3_config';
const WEBDAV_CONFIG_KEY = 'app_webdav_config';
const STORAGE_TYPE_KEY = 'app_storage_type';

const OPFS_TMP_DIR = '/tmp';
const OPFS_GALLERY_DIR = '/gallery';

export const DEFAULT_S3_CONFIG: S3Config = {
    accessKeyId: '',
    secretAccessKey: '',
    bucket: '',
    region: 'us-east-1',
    endpoint: '',
    publicDomain: '',
    prefix: 'peinture/'
};

export const DEFAULT_WEBDAV_CONFIG: WebDAVConfig = {
    url: '',
    username: '',
    password: '',
    directory: 'peinture'
};

// --- Configuration Management ---

export const getS3Config = (): S3Config => {
    if (typeof localStorage === 'undefined') return DEFAULT_S3_CONFIG;
    try {
        const stored = localStorage.getItem(S3_CONFIG_KEY);
        if (stored) {
            return { ...DEFAULT_S3_CONFIG, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error("Failed to load S3 config", e);
    }
    return DEFAULT_S3_CONFIG;
};

export const getWebDAVConfig = (): WebDAVConfig => {
    if (typeof localStorage === 'undefined') return DEFAULT_WEBDAV_CONFIG;
    try {
        const stored = localStorage.getItem(WEBDAV_CONFIG_KEY);
        if (stored) {
            return { ...DEFAULT_WEBDAV_CONFIG, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error("Failed to load WebDAV config", e);
    }
    return DEFAULT_WEBDAV_CONFIG;
};

export const getStorageType = (): StorageType => {
    if (typeof localStorage === 'undefined') return 'opfs';
    const type = localStorage.getItem(STORAGE_TYPE_KEY) as StorageType;
    return ['s3', 'webdav', 'opfs'].includes(type) ? type : 'opfs';
};

export const saveS3Config = (config: S3Config) => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(S3_CONFIG_KEY, JSON.stringify(config));
    }
};

export const saveWebDAVConfig = (config: WebDAVConfig) => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
    }
};

export const saveStorageType = (type: StorageType) => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_TYPE_KEY, type);
    }
};

export const isS3Configured = (config: S3Config): boolean => {
    return !!(config.accessKeyId && config.secretAccessKey);
};

export const isWebDAVConfigured = (config: WebDAVConfig): boolean => {
    return !!(config.url && config.username && config.password);
};

export const isStorageConfigured = (): boolean => {
    const type = getStorageType();
    if (type === 's3') return isS3Configured(getS3Config());
    if (type === 'webdav') return isWebDAVConfigured(getWebDAVConfig());
    if (type === 'opfs') return true;
    return false;
};

// --- Helper ---

const getS3Prefix = (config: S3Config) => {
    let p = config.prefix || 'peinture/';
    // Ensure trailing slash
    if (!p.endsWith('/')) p += '/';
    // Remove leading slash if present (S3 keys usually don't start with / unless intended)
    if (p.startsWith('/')) p = p.substring(1);
    return p;
};

// --- AWS Signature V4 Implementation (Existing) ---

async function hmac(key: CryptoKey, stringToSign: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    return crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign));
}

async function sha256(str: string | ArrayBuffer): Promise<string> {
    const encoder = new TextEncoder();
    const data = typeof str === 'string' ? encoder.encode(str) : str;
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function importKey(keyData: string | ArrayBuffer): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const rawKey = typeof keyData === 'string' ? encoder.encode(keyData) : keyData;
    return crypto.subtle.importKey(
        "raw", 
        rawKey, 
        { name: "HMAC", hash: "SHA-256" }, 
        false, 
        ["sign"]
    );
}

// --- Unified Cloud Operations ---

// Helper to extract Image ID based on specification
export const getFileId = (filename: string): string => {
    const baseName = filename.split('/').pop() || filename;
    const withoutNsfw = baseName.replace(/\.NSFW/i, '');
    return withoutNsfw.replace(/\.[^/.]+$/, "");
};

const convertWebPToPNG = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('Conversion to PNG failed'));
            }, 'image/png');
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        img.src = url;
    });
};

export const uploadToCloud = async (
    blob: Blob, 
    fileName: string,
    metadata?: any
): Promise<string> => {
    const type = getStorageType();
    
    let finalBlob = blob;
    
    if (blob.type === 'image/webp') {
        try {
            finalBlob = await convertWebPToPNG(blob);
        } catch (e) {
            console.warn("WebP to PNG conversion failed", e);
        }
    }

    let finalFileName = fileName;
    
    if (blob.type === 'image/webp' && finalBlob.type === 'image/png' && finalFileName.toLowerCase().endsWith('.webp')) {
         finalFileName = finalFileName.substring(0, finalFileName.length - 5);
    }

    const typeExtMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'video/mp4': '.mp4',
        'video/webm': '.webm'
    };
    const ext = typeExtMap[finalBlob.type];
    
    if (ext && !finalFileName.toLowerCase().endsWith(ext)) {
        finalFileName = finalFileName + ext;
    }

    let fileUrl = '';
    if (type === 's3') {
        const config = getS3Config();
        fileUrl = await uploadToS3(finalBlob, finalFileName, finalBlob.type, config);
    } else if (type === 'webdav') {
        const config = getWebDAVConfig();
        fileUrl = await uploadToWebDAV(finalBlob, finalFileName, config);
    } else if (type === 'opfs') {
        // Upload to Gallery directory for cloud storage flow
        fileUrl = await uploadToOPFSGallery(finalBlob, finalFileName);
    } else {
        throw new Error("error_storage_config_missing");
    }

    if (metadata) {
        try {
            const id = getFileId(finalFileName);
            const metadataFileName = id ? `${id}.metadata.json` : `${finalFileName}.metadata.json`;
            
            const metadataContent = { ...metadata };
            if (!metadataContent.id) metadataContent.id = id;

            const jsonBlob = new Blob([JSON.stringify(metadataContent, null, 2)], { type: "application/json" });
            
            if (type === 's3') {
                const config = getS3Config();
                await uploadToS3(jsonBlob, metadataFileName, "application/json", config);
            } else if (type === 'webdav') {
                const config = getWebDAVConfig();
                await uploadToWebDAV(jsonBlob, metadataFileName, config);
            } else if (type === 'opfs') {
                await uploadToOPFSGallery(jsonBlob, metadataFileName);
            }
        } catch (e) {
            console.error("Failed to upload metadata JSON", e);
        }
    }

    return fileUrl;
};

export const listCloudFiles = async (): Promise<CloudFile[]> => {
    const type = getStorageType();

    if (type === 's3') {
        const config = getS3Config();
        return listS3Files(config);
    } else if (type === 'webdav') {
        const config = getWebDAVConfig();
        return listWebDAVFiles(config);
    } else if (type === 'opfs') {
        return listOPFSGalleryFiles();
    }
    return [];
};

export const fetchCloudBlob = async (url: string): Promise<Blob> => {
    const type = getStorageType();
    
    // Explicit OPFS protocol handling
    if (url.startsWith('opfs://')) {
        return fetchOPFSBlob(url);
    }

    let headers: Record<string, string> = {};

    if (type === 'webdav') {
        const config = getWebDAVConfig();
        const baseUrl = config.url.replace(/\/+$/, '');
        if (url.startsWith(baseUrl)) {
             headers = getWebDAVHeaders(config);
        }
    } else if (type === 's3') {
        const config = getS3Config();
        // If S3 is configured without a public domain, we assume the URL is an endpoint URL that needs signing
        if (!config.publicDomain) {
            return fetchS3Signed(url, 'GET', config);
        }
    }

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    return await response.blob();
};

const fetchS3Signed = async (url: string, method: string, config: S3Config): Promise<Blob> => {
    const urlObj = new URL(url);
    const host = urlObj.host;
    const path = urlObj.pathname;
    const query = urlObj.search;

    const date = new Date();
    const isoDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = isoDate.substring(0, 8);
    const region = config.region || 'us-east-1';
    const service = "s3";

    const payloadHash = await sha256(''); 

    const canonicalHeaders = 
        `host:${host}\n` +
        `x-amz-content-sha256:${payloadHash}\n` +
        `x-amz-date:${isoDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = 
        `${method}\n` +
        `${path}\n` +
        `${query.replace('?', '')}\n` +
        `${canonicalHeaders}\n` +
        `${signedHeaders}\n` +
        `${payloadHash}`;

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = 
        `${algorithm}\n` +
        `${isoDate}\n` +
        `${credentialScope}\n` +
        `${await sha256(canonicalRequest)}`;

    const kSecret = await importKey(`AWS4${config.secretAccessKey}`);
    const kDate = await importKey(await hmac(kSecret, dateStamp));
    const kRegion = await importKey(await hmac(kDate, region));
    const kService = await importKey(await hmac(kRegion, service));
    const kSigning = await importKey(await hmac(kService, "aws4_request"));
    
    const signatureBuffer = await hmac(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const authorizationHeader = 
        `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, ` +
        `Signature=${signature}`;

    const headers: Record<string, string> = {
        "Authorization": authorizationHeader,
        "x-amz-date": isoDate,
        "x-amz-content-sha256": payloadHash,
        "Host": host
    };

    const response = await fetch(url, { method, headers });
    if (!response.ok) throw new Error(`S3 Fetch Failed: ${response.status}`);
    return await response.blob();
};

export const deleteCloudFile = async (keyOrUrl: string): Promise<void> => {
    const type = getStorageType();

    try {
        const id = getFileId(keyOrUrl);
        const jsonKeyOrUrl = id ? `${id}.metadata.json` : `${keyOrUrl}.metadata.json`;
        
        if (type === 's3') {
            const config = getS3Config();
            await deleteS3Object(config, jsonKeyOrUrl).catch(() => {});
        } else if (type === 'webdav') {
            const config = getWebDAVConfig();
            await deleteWebDAVFile(config, jsonKeyOrUrl).catch(() => {});
        } else if (type === 'opfs') {
            await deleteOPFSGalleryFile(jsonKeyOrUrl).catch(() => {});
        }
    } catch (e) {
        console.warn("Metadata delete failed, ignoring", e);
    }

    if (type === 's3') {
        const config = getS3Config();
        return deleteS3Object(config, keyOrUrl);
    } else if (type === 'webdav') {
        const config = getWebDAVConfig();
        return deleteWebDAVFile(config, keyOrUrl);
    } else if (type === 'opfs') {
        return deleteOPFSGalleryFile(keyOrUrl);
    }
};

export const renameCloudFile = async (oldKeyOrUrl: string, newKeyOrUrl: string): Promise<void> => {
    const type = getStorageType();

    if (type === 's3') {
        const config = getS3Config();
        await performS3Rename(config, oldKeyOrUrl, newKeyOrUrl);
    } else if (type === 'webdav') {
        const config = getWebDAVConfig();
        await performWebDAVRename(config, oldKeyOrUrl, newKeyOrUrl);
    } else if (type === 'opfs') {
        // OPFS rename: Read, Write New, Delete Old
        // Ensure we read from gallery directory if input is just a filename
        const readUrl = oldKeyOrUrl.startsWith('opfs://') || oldKeyOrUrl.startsWith('/') 
            ? oldKeyOrUrl 
            : `opfs://${OPFS_GALLERY_DIR}/${oldKeyOrUrl}`;
            
        const blob = await fetchOPFSBlob(readUrl);
        const newFileName = newKeyOrUrl.split('/').pop() || newKeyOrUrl;
        await uploadToOPFSGallery(blob, newFileName);
        // Extract filename from URL/path
        const oldFileName = oldKeyOrUrl.replace('opfs://', '').replace(`${OPFS_GALLERY_DIR}/`, '').split('/').pop();
        if (oldFileName) await deleteOPFSGalleryFile(oldFileName);
    }
};

const performS3Rename = async (config: S3Config, oldKeyOrUrl: string, newKeyOrUrl: string) => {
    const region = config.region || 'us-east-1';
    let endpoint = config.endpoint || `https://s3.${region}.amazonaws.com`;
    endpoint = endpoint.replace(/\/$/, "");
    const bucket = config.bucket || '';
    
    const constructUrl = (key: string) => bucket ? `${endpoint}/${bucket}/${key}` : `${endpoint}/${key}`;
    
    const oldUrl = oldKeyOrUrl.startsWith('http') ? oldKeyOrUrl : constructUrl(oldKeyOrUrl);
    
    const blob = await fetchCloudBlob(oldUrl);
    
    let newKey = newKeyOrUrl.split('/').pop() || newKeyOrUrl;
    
    await uploadToS3(blob, newKey, blob.type, config);
    
    const oldKey = oldKeyOrUrl.startsWith('http') ? oldKeyOrUrl.split('/').pop()! : oldKeyOrUrl;
    await deleteS3Object(config, oldKey);
};

const performWebDAVRename = async (config: WebDAVConfig, oldKeyOrUrl: string, newKeyOrUrl: string) => {
    const sourceUrl = oldKeyOrUrl.startsWith('http') ? oldKeyOrUrl : joinPath(config.url, config.directory, oldKeyOrUrl);
    const destUrl = newKeyOrUrl.startsWith('http') ? newKeyOrUrl : joinPath(config.url, config.directory, newKeyOrUrl);
    
    const response = await fetch(sourceUrl, {
        method: 'MOVE',
        headers: {
            ...getWebDAVHeaders(config),
            'Destination': destUrl
        }
    });

    if (!response.ok && response.status !== 201 && response.status !== 204) {
         throw new Error(`WebDAV Rename Failed: ${response.status}`);
    }
};

// --- OPFS Operations (Updated for Structure) ---

// Init directories
export const initOpfsDirs = async () => {
    try {
        await dir(OPFS_TMP_DIR).create();
        await dir(OPFS_GALLERY_DIR).create();
    } catch (e) {
        console.error("Failed to init OPFS dirs", e);
    }
};

export const clearOPFS = async () => {
    const root = dir('/');
    const children = await root.children();
    for (const child of children) {
        await child.remove();
    }
    // Re-init directories after clear
    await initOpfsDirs();
};

// -- TMP Directory Operations --

export const saveTempFileToOPFS = async (blob: Blob, fileName: string) => {
    await initOpfsDirs(); // Ensure exists
    const buffer = await blob.arrayBuffer();
    await write(`${OPFS_TMP_DIR}/${fileName}`, buffer);
    return `opfs://${OPFS_TMP_DIR}/${fileName}`;
};

export const renameTempFileFromOPFS = async (oldFileName: string, newFileName: string) => {
    try {
        const oldFile = file(`${OPFS_TMP_DIR}/${oldFileName}`);
        if (await oldFile.exists()) {
            const buffer = await oldFile.arrayBuffer();
            await write(`${OPFS_TMP_DIR}/${newFileName}`, buffer);
            await oldFile.remove();
            return true;
        }
    } catch (e) {
        console.warn("Rename tmp failed", e);
    }
    return false;
};

export const readTempFileFromOPFS = async (fileName: string): Promise<Blob | null> => {
    try {
        const f = file(`${OPFS_TMP_DIR}/${fileName}`);
        if (!await f.exists()) return null;
        return new Blob([await f.arrayBuffer()]);
    } catch (e) {
        console.warn(`Failed to read tmp file ${fileName}`, e);
        return null;
    }
};

export const deleteTempFileFromOPFS = async (fileName: string) => {
    try {
        const f = file(`${OPFS_TMP_DIR}/${fileName}`);
        if (await f.exists()) await f.remove();
    } catch (e) {
        console.warn(`Failed to delete tmp file ${fileName}`, e);
    }
};

// -- Gallery Directory Operations --

const uploadToOPFSGallery = async (blob: Blob, fileName: string) => {
    await initOpfsDirs();
    const buffer = await blob.arrayBuffer();
    await write(`${OPFS_GALLERY_DIR}/${fileName}`, buffer);
    return `opfs://${OPFS_GALLERY_DIR}/${fileName}`;
};

const listOPFSGalleryFiles = async () => {
    await initOpfsDirs();
    const root = await navigator.storage.getDirectory();
    // Navigate to gallery dir manually via handle
    const galleryHandle = await root.getDirectoryHandle('gallery', { create: true });
    
    const files: CloudFile[] = [];
    
    // @ts-ignore
    for await (const [name, handle] of galleryHandle.entries()) {
        if (handle.kind === 'file') {
             const f = await (handle as FileSystemFileHandle).getFile();
             const key = name;
             const lowerKey = key.toLowerCase();
             let type: 'image' | 'video' | 'unknown' = 'unknown';
             if (lowerKey.match(/\.(jpg|jpeg|png|webp|gif)$/)) type = 'image';
             else if (lowerKey.match(/\.(mp4|webm|mov)$/)) type = 'video';
             
             if (type !== 'unknown') {
                 files.push({
                     key,
                     lastModified: new Date(f.lastModified),
                     size: f.size,
                     url: `opfs://${OPFS_GALLERY_DIR}/${key}`,
                     type
                 });
             }
        }
    }
    return files;
};

const fetchOPFSBlob = async (url: string) => {
    // URL format: opfs://path/to/file or just absolute path logic
    const path = url.replace('opfs://', ''); // Remove protocol
    // Ensure path starts with / if not present (write logic uses absolute paths)
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    const f = file(normalizedPath);
    if (!await f.exists()) throw new Error('File not found in OPFS');
    return new Blob([await f.arrayBuffer()]);
};

const deleteOPFSGalleryFile = async (key: string) => {
    // Key is filename
    // Handle if key is full URL or just filename
    const fileName = key.replace(`opfs://${OPFS_GALLERY_DIR}/`, '');
    await file(`${OPFS_GALLERY_DIR}/${fileName}`).remove();
};

// --- S3 Operations (Internal) ---

const uploadToS3 = async (
    blob: Blob, 
    fileName: string, 
    contentType: string, 
    config: S3Config
): Promise<string> => {
    if (!config.accessKeyId || !config.secretAccessKey) {
        throw new Error("error_s3_config_missing");
    }

    const date = new Date();
    const isoDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = isoDate.substring(0, 8);
    const region = config.region || 'us-east-1';
    const service = "s3";
    const bucket = config.bucket || '';
    const prefix = getS3Prefix(config);
    
    // Check if filename already has the prefix to avoid double nesting
    const key = fileName.startsWith(prefix) ? fileName : `${prefix}${fileName}`;

    let endpoint = config.endpoint || `https://s3.${region}.amazonaws.com`;
    endpoint = endpoint.replace(/\/$/, "");
    
    const host = new URL(endpoint).host;
    
    const url = bucket ? `${endpoint}/${bucket}/${key}` : `${endpoint}/${key}`;

    const payloadHash = await sha256(await blob.arrayBuffer());

    const method = "PUT";
    const canonicalUri = bucket ? `/${bucket}/${key}` : `/${key}`;
    const canonicalQueryString = "";
    const canonicalHeaders = 
        `host:${host}\n` +
        `x-amz-content-sha256:${payloadHash}\n` +
        `x-amz-date:${isoDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    
    const canonicalRequest = 
        `${method}\n` +
        `${canonicalUri}\n` +
        `${canonicalQueryString}\n` +
        `${canonicalHeaders}\n` +
        `${signedHeaders}\n` +
        `${payloadHash}`;

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = 
        `${algorithm}\n` +
        `${isoDate}\n` +
        `${credentialScope}\n` +
        `${await sha256(canonicalRequest)}`;

    const kSecret = await importKey(`AWS4${config.secretAccessKey}`);
    const kDate = await importKey(await hmac(kSecret, dateStamp));
    const kRegion = await importKey(await hmac(kDate, region));
    const kService = await importKey(await hmac(kRegion, service));
    const kSigning = await importKey(await hmac(kService, "aws4_request"));
    
    const signatureBuffer = await hmac(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const authorizationHeader = 
        `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, ` +
        `Signature=${signature}`;

    const response = await fetch(url, {
        method: method,
        headers: {
            "Authorization": authorizationHeader,
            "x-amz-date": isoDate,
            "x-amz-content-sha256": payloadHash,
            "Content-Type": contentType,
            "Host": host
        },
        body: blob
    });

    if (!response.ok) {
        throw new Error(`S3 Upload Failed: ${response.status} ${response.statusText}`);
    }

    if (config.publicDomain) {
        const domain = config.publicDomain.replace(/\/$/, "");
        return `${domain}/${key}`;
    }
    
    return url;
};

export const listS3Files = async (config: S3Config): Promise<CloudFile[]> => {
    if (!isS3Configured(config)) {
        return [];
    }

    const date = new Date();
    const isoDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = isoDate.substring(0, 8);
    const region = config.region || 'us-east-1';
    const service = "s3";
    const bucket = config.bucket || '';
    const prefix = getS3Prefix(config);

    let endpoint = config.endpoint || `https://s3.${region}.amazonaws.com`;
    endpoint = endpoint.replace(/\/$/, "");
    const host = new URL(endpoint).host;
    const url = bucket ? `${endpoint}/${bucket}` : `${endpoint}`;

    const listType = '2';
    
    const canonicalQueryString = `list-type=${listType}&prefix=${encodeURIComponent(prefix)}`;
    
    const payloadHash = await sha256(''); 

    const method = "GET";
    const canonicalUri = bucket ? `/${bucket}` : `/`;
    const canonicalHeaders = 
        `host:${host}\n` +
        `x-amz-content-sha256:${payloadHash}\n` +
        `x-amz-date:${isoDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = 
        `${method}\n` +
        `${canonicalUri}\n` +
        `${canonicalQueryString}\n` +
        `${canonicalHeaders}\n` +
        `${signedHeaders}\n` +
        `${payloadHash}`;

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = 
        `${algorithm}\n` +
        `${isoDate}\n` +
        `${credentialScope}\n` +
        `${await sha256(canonicalRequest)}`;

    const kSecret = await importKey(`AWS4${config.secretAccessKey}`);
    const kDate = await importKey(await hmac(kSecret, dateStamp));
    const kRegion = await importKey(await hmac(kDate, region));
    const kService = await importKey(await hmac(kRegion, service));
    const kSigning = await importKey(await hmac(kService, "aws4_request"));
    
    const signatureBuffer = await hmac(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const authorizationHeader = 
        `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, ` +
        `Signature=${signature}`;

    try {
        const response = await fetch(`${url}?${canonicalQueryString}`, {
            method: method,
            headers: {
                "Authorization": authorizationHeader,
                "x-amz-date": isoDate,
                "x-amz-content-sha256": payloadHash,
                "Host": host
            }
        });

        if (!response.ok) {
            console.error("S3 List Failed", response.status, response.statusText);
            return [];
        }

        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const contents = xmlDoc.getElementsByTagName("Contents");
        const files: CloudFile[] = [];
        
        const domain = config.publicDomain ? config.publicDomain.replace(/\/$/, "") : "";

        for (let i = 0; i < contents.length; i++) {
            const key = contents[i].getElementsByTagName("Key")[0].textContent || "";
            if (key === prefix) continue;

            const size = parseInt(contents[i].getElementsByTagName("Size")[0].textContent || "0", 10);
            const lastModified = new Date(contents[i].getElementsByTagName("LastModified")[0].textContent || "");
            
            const lowerKey = key.toLowerCase();
            let type: 'image' | 'video' | 'unknown' = 'unknown';
            if (lowerKey.match(/\.(jpg|jpeg|png|webp|gif)$/)) type = 'image';
            else if (lowerKey.match(/\.(mp4|webm|mov)$/)) type = 'video';

            if (type !== 'unknown') {
                const fileUrl = domain ? `${domain}/${key}` : (bucket ? `${endpoint}/${bucket}/${key}` : `${endpoint}/${key}`);

                files.push({
                    key,
                    lastModified,
                    size,
                    url: fileUrl,
                    type
                });
            }
        }

        return files;

    } catch (e) {
        console.error("Error listing S3 files", e);
        return [];
    }
};

export const deleteS3Object = async (config: S3Config, key: string): Promise<void> => {
    if (!config.accessKeyId || !config.secretAccessKey) {
        throw new Error("error_s3_config_missing");
    }

    const date = new Date();
    const isoDate = date.toISOString().replace(/[:-]|\.\d{3}/g, ""); 
    const dateStamp = isoDate.substring(0, 8);
    const region = config.region || 'us-east-1';
    const service = "s3";
    const bucket = config.bucket || '';

    let endpoint = config.endpoint || `https://s3.${region}.amazonaws.com`;
    endpoint = endpoint.replace(/\/$/, "");
    const host = new URL(endpoint).host;
    
    const uriPath = bucket ? `/${bucket}/${key}` : `/${key}`;
    const url = bucket ? `${endpoint}/${bucket}/${key}` : `${endpoint}/${key}`;

    const method = "DELETE";
    const payloadHash = await sha256(''); 

    const canonicalHeaders = 
        `host:${host}\n` +
        `x-amz-content-sha256:${payloadHash}\n` +
        `x-amz-date:${isoDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = 
        `${method}\n` +
        `${uriPath}\n` +
        `\n` + 
        `${canonicalHeaders}\n` +
        `${signedHeaders}\n` +
        `${payloadHash}`;

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = 
        `${algorithm}\n` +
        `${isoDate}\n` +
        `${credentialScope}\n` +
        `${await sha256(canonicalRequest)}`;

    const kSecret = await importKey(`AWS4${config.secretAccessKey}`);
    const kDate = await importKey(await hmac(kSecret, dateStamp));
    const kRegion = await importKey(await hmac(kDate, region));
    const kService = await importKey(await hmac(kRegion, service));
    const kSigning = await importKey(await hmac(kService, "aws4_request"));
    
    const signatureBuffer = await hmac(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const authorizationHeader = 
        `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, ` +
        `Signature=${signature}`;

    const response = await fetch(url, {
        method: method,
        headers: {
            "Authorization": authorizationHeader,
            "x-amz-date": isoDate,
            "x-amz-content-sha256": payloadHash,
            "Host": host
        }
    });

    if (!response.ok && response.status !== 204) {
         throw new Error(`S3 Delete Failed: ${response.status} ${response.statusText}`);
    }
};

export const testS3Connection = async (config: S3Config): Promise<{ success: boolean; message: string }> => {
    if (!isS3Configured(config)) {
        return { success: false, message: "Configuration incomplete" };
    }

    try {
        const date = new Date();
        const isoDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = isoDate.substring(0, 8);
        const region = config.region || 'us-east-1';
        const service = "s3";
        const bucket = config.bucket || '';

        let endpoint = config.endpoint || `https://s3.${region}.amazonaws.com`;
        endpoint = endpoint.replace(/\/$/, "");
        const host = new URL(endpoint).host;
        const url = bucket ? `${endpoint}/${bucket}` : `${endpoint}`;

        const listType = '2';
        const canonicalQueryString = `list-type=${listType}&max-keys=1`;
        
        const payloadHash = await sha256(''); 

        const method = "GET";
        const canonicalUri = bucket ? `/${bucket}` : `/`;
        const canonicalHeaders = 
            `host:${host}\n` +
            `x-amz-content-sha256:${payloadHash}\n` +
            `x-amz-date:${isoDate}\n`;
        const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

        const canonicalRequest = 
            `${method}\n` +
            `${canonicalUri}\n` +
            `${canonicalQueryString}\n` +
            `${canonicalHeaders}\n` +
            `${signedHeaders}\n` +
            `${payloadHash}`;

        const algorithm = "AWS4-HMAC-SHA256";
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const stringToSign = 
            `${algorithm}\n` +
            `${isoDate}\n` +
            `${credentialScope}\n` +
            `${await sha256(canonicalRequest)}`;

        const kSecret = await importKey(`AWS4${config.secretAccessKey}`);
        const kDate = await importKey(await hmac(kSecret, dateStamp));
        const kRegion = await importKey(await hmac(kDate, region));
        const kService = await importKey(await hmac(kRegion, service));
        const kSigning = await importKey(await hmac(kService, "aws4_request"));
        
        const signatureBuffer = await hmac(kSigning, stringToSign);
        const signature = Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const authorizationHeader = 
            `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, ` +
            `Signature=${signature}`;

        const response = await fetch(`${url}?${canonicalQueryString}`, {
            method: method,
            headers: {
                "Authorization": authorizationHeader,
                "x-amz-date": isoDate,
                "x-amz-content-sha256": payloadHash,
                "Host": host
            }
        });

        if (response.ok) {
            return { success: true, message: "Connection successful" };
        } else {
            return { success: false, message: `Connection failed: ${response.status} ${response.statusText}` };
        }
    } catch (e: any) {
        return { success: false, message: `Connection error: ${e.message}` };
    }
};

// --- WebDAV Operations (Internal) ---

const getWebDAVHeaders = (config: WebDAVConfig) => {
    return {
        'Authorization': `Basic ${btoa(`${config.username}:${config.password}`)}`,
    };
};

const joinPath = (base: string, ...parts: string[]) => {
    let url = base.replace(/\/+$/, '');
    parts.forEach(part => {
        if (!part) return;
        url += '/' + part.replace(/^\/+/, '').replace(/\/+$/, '');
    });
    return url;
};

const uploadToWebDAV = async (
    blob: Blob, 
    fileName: string, 
    config: WebDAVConfig
): Promise<string> => {
    if (!isWebDAVConfigured(config)) {
        throw new Error("error_webdav_config_missing");
    }

    const dir = config.directory || 'peinture';
    const uploadUrl = joinPath(config.url, dir, fileName);

    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: getWebDAVHeaders(config),
        body: blob
    });

    if (!response.ok) {
        throw new Error(`WebDAV Upload Failed: ${response.status}`);
    }

    return uploadUrl;
};

const listWebDAVFiles = async (config: WebDAVConfig): Promise<CloudFile[]> => {
    if (!isWebDAVConfigured(config)) {
        return [];
    }

    const dir = config.directory || 'peinture';
    const listUrl = joinPath(config.url, dir);
    
    try {
        const response = await fetch(listUrl, {
            method: 'PROPFIND',
            headers: {
                ...getWebDAVHeaders(config),
                'Depth': '1'
            }
        });

        if (!response.ok) {
            console.error("WebDAV List Failed", response.status);
            return [];
        }

        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const responses = xmlDoc.querySelectorAll('response');
        const files: CloudFile[] = [];

        const basePath = new URL(listUrl).pathname;

        for (let i = 0; i < responses.length; i++) {
            const href = responses[i].querySelector('href')?.textContent || "";
            const props = responses[i].querySelector('propstat > prop');
            
            if (!href || !props) continue;

            const urlPath = new URL(href, config.url).pathname;
            const decodedPath = decodeURIComponent(urlPath);
            const decodedBasePath = decodeURIComponent(basePath);

            if (decodedPath.replace(/\/$/, '') === decodedBasePath.replace(/\/$/, '')) continue;
            
            const fileName = decodedPath.split('/').pop() || "";
            if (!fileName) continue;

            const lastModStr = props.querySelector('getlastmodified')?.textContent;
            const lastModified = lastModStr ? new Date(lastModStr) : new Date();

            const lengthStr = props.querySelector('getcontentlength')?.textContent;
            const size = lengthStr ? parseInt(lengthStr, 10) : 0;
            
            const lowerName = fileName.toLowerCase();
            let type: 'image' | 'video' | 'unknown' = 'unknown';
            if (lowerName.match(/\.(jpg|jpeg|png|webp|gif)$/)) type = 'image';
            else if (lowerName.match(/\.(mp4|webm|mov)$/)) type = 'video';

            if (type !== 'unknown') {
                const fileUrl = new URL(href, config.url).toString();

                files.push({
                    key: fileUrl,
                    lastModified,
                    size,
                    url: fileUrl,
                    type
                });
            }
        }
        return files;

    } catch (e) {
        console.error("Error listing WebDAV files", e);
        return [];
    }
};

const deleteWebDAVFile = async (config: WebDAVConfig, fileUrl: string): Promise<void> => {
    if (!isWebDAVConfigured(config)) {
        throw new Error("error_webdav_config_missing");
    }

    const response = await fetch(fileUrl, {
        method: 'DELETE',
        headers: getWebDAVHeaders(config)
    });

    if (!response.ok) {
        throw new Error(`WebDAV Delete Failed: ${response.status}`);
    }
};

export const testWebDAVConnection = async (config: WebDAVConfig): Promise<{ success: boolean; message: string }> => {
    if (!isWebDAVConfigured(config)) {
        return { success: false, message: "Configuration incomplete" };
    }

    try {
        const rootResponse = await fetch(config.url, {
            method: 'PROPFIND',
            headers: {
                ...getWebDAVHeaders(config),
                'Depth': '0'
            }
        });

        if (!rootResponse.ok) {
            return { success: false, message: `Connection failed: ${rootResponse.status}` };
        }
        return { success: true, message: "Connection successful" };
    } catch (e: any) {
        return { success: false, message: `Connection error: ${e.message}` };
    }
};
