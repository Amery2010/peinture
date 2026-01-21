
import React, { useState } from 'react';
import { Eye, EyeOff, PlugZap, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { translations } from '../../translations';
import { S3Config, WebDAVConfig } from '../../types';

interface StorageTabProps {
    activeTab: string;
    s3Config: S3Config; setS3Config: (v: S3Config) => void;
    webdavConfig: WebDAVConfig; setWebdavConfig: (v: WebDAVConfig) => void;
    testS3Result: { success: boolean; message: string } | null;
    isTestingS3: boolean;
    handleTestS3: () => void;
    testWebDAVResult: { success: boolean; message: string } | null;
    isTestingWebDAV: boolean;
    handleTestWebDAV: () => void;
}

export const StorageTab: React.FC<StorageTabProps> = (props) => {
    const { language } = useAppStore();
    const t = translations[language];
    const [showS3Secret, setShowS3Secret] = useState(false);
    const [showWebdavPass, setShowWebdavPass] = useState(false);

    const getEndpointPlaceholder = () => {
         const region = props.s3Config.region || 'us-east-1';
         return `https://s3.${region}.amazonaws.com`;
    };

    if (props.activeTab === 's3') {
        return (
            <div className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-medium text-white/80 w-1/3 flex-shrink-0">{t.s3_access_key}</label>
                        <input type="text" value={props.s3Config.accessKeyId} onChange={(e) => props.setS3Config({ ...props.s3Config, accessKeyId: e.target.value })} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-green-500/50 transition-all font-mono" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-medium text-white/80 w-1/3 flex-shrink-0">{t.s3_secret_key}</label>
                        <div className="relative w-full">
                            <input type={showS3Secret ? "text" : "password"} value={props.s3Config.secretAccessKey} onChange={(e) => props.setS3Config({ ...props.s3Config, secretAccessKey: e.target.value })} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-green-500/50 transition-all font-mono pr-8" />
                            <button type="button" onClick={() => setShowS3Secret(!showS3Secret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">{showS3Secret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-white/60 block">{t.s3_bucket}</label>
                            <input type="text" value={props.s3Config.bucket || ''} onChange={(e) => props.setS3Config({ ...props.s3Config, bucket: e.target.value })} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-green-500/50 transition-all" />
                        </div>
                        <div className="w-1/3 space-y-1">
                            <label className="text-xs font-medium text-white/60 block">{t.s3_region}</label>
                            <input type="text" value={props.s3Config.region || ''} onChange={(e) => props.setS3Config({ ...props.s3Config, region: e.target.value })} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-green-500/50 transition-all" />
                        </div>
                    </div>
                    <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-white/60 block">{t.s3_endpoint}</label>
                        <input type="text" value={props.s3Config.endpoint || ''} onChange={(e) => props.setS3Config({ ...props.s3Config, endpoint: e.target.value })} placeholder={getEndpointPlaceholder()} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-green-500/50 transition-all" />
                    </div>
                        <div className="flex gap-4">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-white/60 block">{t.s3_domain}</label>
                            <input type="text" value={props.s3Config.publicDomain || ''} onChange={(e) => props.setS3Config({ ...props.s3Config, publicDomain: e.target.value })} placeholder={t.s3_domain_placeholder} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-green-500/50 transition-all" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-white/60 block">{t.s3_prefix}</label>
                            <input type="text" value={props.s3Config.prefix ?? 'peinture/'} onChange={(e) => props.setS3Config({ ...props.s3Config, prefix: e.target.value })} placeholder={t.s3_prefix_placeholder} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-green-500/50 transition-all font-mono" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-end">
                            <button onClick={props.handleTestS3} disabled={props.isTestingS3} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30 transition-all text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                                {props.isTestingS3 ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t.testing}</> : <><PlugZap className="w-3.5 h-3.5" />{t.test_connection}</>}
                            </button>
                        </div>
                        {props.testS3Result && (
                            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${props.testS3Result.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                {props.testS3Result.success ? <Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                                <span>{props.testS3Result.message}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (props.activeTab === 'webdav') {
        return (
            <div className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-medium text-white/80 w-1/3 flex-shrink-0">{t.webdav_url}</label>
                        <input type="text" value={props.webdavConfig.url} onChange={(e) => props.setWebdavConfig({ ...props.webdavConfig, url: e.target.value })} placeholder={t.webdav_url_placeholder} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-blue-500/50 transition-all font-mono" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-medium text-white/80 w-1/3 flex-shrink-0">{t.webdav_username}</label>
                        <input type="text" value={props.webdavConfig.username} onChange={(e) => props.setWebdavConfig({ ...props.webdavConfig, username: e.target.value })} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-blue-500/50 transition-all font-mono" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-medium text-white/80 w-1/3 flex-shrink-0">{t.webdav_password}</label>
                        <div className="relative w-full">
                            <input type={showWebdavPass ? "text" : "password"} value={props.webdavConfig.password} onChange={(e) => props.setWebdavConfig({ ...props.webdavConfig, password: e.target.value })} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-blue-500/50 transition-all font-mono pr-8" />
                            <button type="button" onClick={() => setShowWebdavPass(!showWebdavPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">{showWebdavPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-medium text-white/80 w-1/3 flex-shrink-0">{t.webdav_directory}</label>
                        <input type="text" value={props.webdavConfig.directory} onChange={(e) => props.setWebdavConfig({ ...props.webdavConfig, directory: e.target.value })} className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white text-sm focus:outline-0 focus:border-blue-500/50 transition-all font-mono" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-end">
                            <button onClick={props.handleTestWebDAV} disabled={props.isTestingWebDAV} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 transition-all text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                                {props.isTestingWebDAV ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t.testing}</> : <><PlugZap className="w-3.5 h-3.5" />{t.test_connection}</>}
                            </button>
                        </div>
                        {props.testWebDAVResult && (
                            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${props.testWebDAVResult.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                {props.testWebDAVResult.success ? <Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                                <span>{props.testWebDAVResult.message}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    return null;
};
