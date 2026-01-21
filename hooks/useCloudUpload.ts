
import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { generateUUID, fetchBlob, getExtensionFromUrl } from '../services/utils';
import { isStorageConfigured, uploadToCloud } from '../services/storageService';
import { CloudImage } from '../types';
import { translations } from '../translations';

export const useCloudUpload = () => {
    const { 
        language,
        currentImage,
        imageDimensions,
        cloudHistory,
        setCloudHistory,
        isUploading,
        setIsUploading
    } = useAppStore();
    
    const [uploadError, setUploadError] = useState<string | null>(null);
    const t = translations[language];

    const handleUploadToCloud = async (imageBlobOrUrl: Blob | string, fileName?: string, metadata?: any) => {
        if (isUploading) return;
        setIsUploading(true);
        setUploadError(null);
        
        try {
            if (!isStorageConfigured()) {
                throw new Error("error_storage_config_missing");
            }
    
            let blob: Blob;
            let finalFileName = fileName || `generated-${generateUUID()}`;
            
            if (typeof imageBlobOrUrl === 'string') {
                blob = await fetchBlob(imageBlobOrUrl);
            } else {
                blob = imageBlobOrUrl;
            }
    
            const finalMetadata = metadata || (currentImage ? { ...currentImage } : null);
            
            // Append dimensions if missing and available in store context
            if (finalMetadata && imageDimensions && !finalMetadata.width && !finalMetadata.height) {
                finalMetadata.width = imageDimensions.width;
                finalMetadata.height = imageDimensions.height;
            }
    
            // Ensure extension
            if (currentImage && !finalFileName.match(/\.[a-zA-Z0-9]+$/)) {
                 const ext = getExtensionFromUrl(currentImage.url) || 'png';
                 finalFileName += `.${ext}`;
            }
    
            const uploadedUrl = await uploadToCloud(blob, finalFileName, finalMetadata);
    
            const cloudImage: CloudImage = {
                id: generateUUID(),
                url: uploadedUrl,
                prompt: finalFileName,
                timestamp: Date.now(),
                fileName: finalFileName
            };
            
            setCloudHistory(prev => [cloudImage, ...prev]);
            console.log("Upload Success:", uploadedUrl);
            
        } catch (e: any) {
            console.error("Cloud Upload Failed", e);
            const msg = (t as any)[e.message] || t.error_s3_upload_failed; 
            setUploadError(msg);
            throw e; // Re-throw to allow callers to handle specific UI updates if needed
        } finally {
            setIsUploading(false);
        }
    };

    return {
        handleUploadToCloud,
        isUploading,
        uploadError,
        setUploadError
    };
};
