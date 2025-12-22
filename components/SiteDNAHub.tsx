
import React from 'react';
import { Site } from '../types';
import { SiteAssetRegister } from './SiteAssetRegister';

interface Props {
  site: Site;
  onUpdate: (site: Site) => void;
  readOnly?: boolean;
}

/**
 * @deprecated Wrapper for backward compatibility. Prefer using SiteAssetRegister directly.
 */
export const SiteDNAHub: React.FC<Props> = ({ site, onUpdate, readOnly = false }) => {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4">
       <SiteAssetRegister site={site} onUpdate={onUpdate} readOnly={readOnly} />
    </div>
  );
};
