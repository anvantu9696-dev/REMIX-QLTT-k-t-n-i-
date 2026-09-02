const fs = require('fs');
let content = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

const importTarget = "import { User, LogOut, Moon, Sun, Monitor, Lock, Globe, Bell, Shield, Cloud, Download, Upload, AlertTriangle, ShieldAlert, RefreshCw, Smartphone, Key, Database, Cpu, Wifi, CheckCircle2, XCircle } from 'lucide-react';";
if (!content.includes(importTarget)) {
  const currentImport = "import { User, LogOut, Moon, Sun, Monitor, Lock, Globe, Bell, Shield, Cloud, Download, Upload, AlertTriangle, ShieldAlert, RefreshCw, Smartphone, Key, Database, Cpu, Wifi } from 'lucide-react';";
  content = content.replace(currentImport, importTarget);
  
  if (content.includes("CheckCircle2") && !content.includes("XCircle } from 'lucide-react'")) {
     // fallback
     content = content.replace("CheckCircle2,", "CheckCircle2, XCircle,");
  }
}
fs.writeFileSync('src/pages/SettingsPage.tsx', content);
