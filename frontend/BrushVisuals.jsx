import React, { useState } from "react";
import { avatars } from "./i18n.js";

const IconSmile = ({size=20, className=""}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>
  </svg>
);
const IconMeh = ({size=20, className=""}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><line x1="8" x2="16" y1="15" y2="15"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>
  </svg>
);
const IconFrown = ({size=20, className=""}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>
  </svg>
);
export const IconTrophy = ({size=18, className=""}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);
export const IconSun = ({size=20, className=""}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
  </svg>
);
export const IconMoon = ({size=20, className=""}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
  </svg>
);
export const IconRefresh = ({size=20, className=""}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>
  </svg>
);
export const IconActivity = ({size=16, className=""}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconSparkles = ({size=16, className=""}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  </svg>
);

export const IconBattery = ({size=24, className="", level, charging, chargingLabel}) => {
  let fillWidth = 14;
  let color = "text-green-500";
  if (level === undefined || level === null) {
    return (
      <div className={`relative flex items-center ${className} opacity-50`} title={charging ? chargingLabel : undefined}>
        {charging && <span aria-hidden="true">⚡</span>}
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
          <rect width="18" height="12" x="2" y="6" rx="2" ry="2"/><path d="M22 11v2"/><path d="M10 10h.01" />
        </svg>
      </div>
    );
  }
  fillWidth = Math.max(2, Math.min(14, (level / 100) * 14));
  if (level < 20) color = "text-red-500";
  else if (level < 50) color = "text-yellow-500";

  return (
    <div className={`relative flex items-center ${className}`} title={charging ? chargingLabel : undefined}>
      {charging && <span className="absolute -top-1 -right-1 text-[10px] animate-pulse">⚡</span>}
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={color}>
        <rect width="18" height="12" x="2" y="6" rx="2" ry="2"/>
        <path d="M22 11v2"/>
        <rect width={fillWidth} height="8" x="4" y="8" rx="1" ry="1" fill="currentColor" stroke="none" />
      </svg>
      <span className="text-[10px] font-bold ml-1 text-slate-500">{level}%</span>
    </div>
  );
};


const getBrushStatus = (duration, language = 'bg') => {
  const labels = {
    bg: ['Кратко', 'Почти', 'Супер'],
    en: ['Short', 'Almost', 'Great'],
    lt: ['Trumpai', 'Beveik', 'Puiku']
  };
  if (duration < 60) return { icon: IconFrown, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', label: labels[language][0] };
  if (duration < 120) return { icon: IconMeh, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', label: labels[language][1] };
  return { icon: IconSmile, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: labels[language][2] };
};

export const secondsToMissionText = (seconds, target, language = 'bg') => {
  const missionTexts = {
    bg: ['Мисия изпълнена', 'Почти перфектно', 'Продължавай', 'Мисия в прогрес'],
    en: ['Mission complete', 'Almost perfect', 'Keep going', 'Mission in progress'],
    lt: ['Misija įvykdyta', 'Beveik tobula', 'Tęsk', 'Misija vyksta']
  };
  if (seconds >= target) return missionTexts[language][0];
  if (seconds >= 90) return missionTexts[language][1];
  if (seconds >= 45) return missionTexts[language][2];
  return missionTexts[language][3];
};

export const SafeAvatar = ({ user, image }) => {
  const [error, setError] = useState(false);
  if (!image || error) {
    const emoji = avatars[user.avatar];
    return (
      <div className="w-full h-full flex items-center justify-center bg-white text-3xl select-none" style={{ color: user.color }}>
        <span className={emoji ? "avatar-emoji text-4xl" : "font-black opacity-50 text-4xl"}>
          {emoji || user.name.charAt(0)}
        </span>
      </div>
    );
  }
  return <img src={image} alt="" className="w-full h-full object-cover" onError={() => setError(true)} />;
};

export const ProgressRing = ({ progress = 0, size = 94, stroke = 8, color = '#22c55e', track = '#dbeafe', children }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (progress / 100) * circumference;

  return (
    <div className="progress-ring relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          className="progress-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dash}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export const BigCircle = ({ brush, title, iconType, language, timeZone }) => {
  const status = getBrushStatus(brush.duration, language);
  const Icon = status.icon;
  const time = new Date(brush.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone });
  const TopIcon = iconType === 'sun' ? IconSun : IconMoon;

  return (
    <div className="flex flex-col items-center group">
      <div className="flex flex-col items-center leading-none mb-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
      </div>
      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${status.bg} ${status.border} border-2 ${status.color} shadow-sm group-hover:scale-105 relative`}>
        <Icon size={28} className={status.color} />
        <div className="absolute -top-2 -right-2 bg-white rounded-full border border-slate-200 p-1 shadow-sm">
          <TopIcon size={11} className="text-slate-400" />
        </div>
      </div>
      <div className="mt-1 text-[10px] font-mono font-medium text-slate-500">{time}</div>
    </div>
  );
};

export const GhostCircle = ({ title, icon: Icon }) => (
  <div className="flex flex-col items-center opacity-30">
    <div className="flex flex-col items-center leading-none mb-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
    </div>
    <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400">
      <Icon size={22} />
    </div>
    <div className="mt-1 text-[10px] font-mono text-transparent select-none">--:--</div>
  </div>
);

export const SmallCircle = ({ brush, language, target, secondsLabel }) => {
  const [flipped, setFlipped] = useState(false);
  const status = getBrushStatus(brush.duration, language);
  const Icon = status.icon;
  const isGreatBrush = brush.duration >= target;
  const triggerFlip = () => {
    setFlipped(true);
    setTimeout(() => setFlipped(false), 1200);
  };
  return (
    <div className="relative z-10 mx-0.5">
      <button type="button" onClick={triggerFlip} className="flip-card w-8 h-8" aria-label={`${brush.duration} ${secondsLabel}`}>
        <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
          <div className={`flip-face ${status.bg} ${status.border} border ${status.color} opacity-80 shadow-sm`}>
            <Icon size={16} className={status.color} />
          </div>
          <div className={`flip-face flip-back ${status.bg} ${status.border} border ${status.color} opacity-90 shadow-sm`}>
            <span className="text-[8px] font-black leading-none">{brush.duration}</span>
            {isGreatBrush && <span className="text-[8px] leading-none">👍</span>}
          </div>
        </div>
      </button>
    </div>
  );
};
