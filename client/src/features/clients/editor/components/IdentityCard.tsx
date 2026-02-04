import React from 'react';
import { Camera, X } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import type { UpdateClientField } from '../../types';
import { CompactInput, Button, panelSoftMd } from '../../../../shared/ui';

interface Props {
  data: ClientEntity;
  update: UpdateClientField;
  onPhotoUpload: () => void;
  onPhotoRemove: (idx: number) => void;
}

export const IdentityCard: React.FC<Props> = ({ data, update, onPhotoUpload, onPhotoRemove }) => {
  return (
    <div className={`${panelSoftMd} p-4 md:p-6 relative overflow-hidden`}>
      <div className="mb-6">
        {/* 只有用户名，没有箭头了 */}
        <div className="flex items-center gap-2 mb-4">
          <input
            className="text-xl md:text-2xl font-black text-slate-800 bg-transparent outline-none w-full placeholder:text-slate-300"
            placeholder="Client Name"
            value={data.wechatName}
            onChange={(e) => update('wechatName', e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Button
            type="button"
            variant="ghost"
            onClick={onPhotoUpload}
            title="Add photo"
            aria-label="Add photo"
            className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0 hover:bg-slate-100 transition-all group"
          >
            <Camera size={20} className="text-slate-300 group-hover:text-slate-400" />
          </Button>
          {data.photos &&
            data.photos.map((p, idx) => (
              <div
                key={idx}
                className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 relative group border border-slate-100"
              >
                <img src={p} alt="" className="w-full h-full object-cover" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/50 text-white p-0.5 opacity-0 group-hover:opacity-100"
                  onClick={() => onPhotoRemove(idx)}
                  aria-label="Remove photo"
                >
                  <X size={8} />
                </Button>
              </div>
            ))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CompactInput
            label="WeChat ID"
            value={data.wechatId}
            onChange={(e) => update('wechatId', e.target.value)}
          />
          <CompactInput
            label="Real Name"
            value={data.realName}
            onChange={(e) => update('realName', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CompactInput
            label="XHS Name"
            value={data.xhsName}
            onChange={(e) => update('xhsName', e.target.value)}
          />
          <CompactInput
            label="XHS ID"
            value={data.xhsId}
            onChange={(e) => update('xhsId', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
