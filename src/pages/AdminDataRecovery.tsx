import React, { useState, useEffect } from 'react';

export default function AdminDataRecovery() {
  const [data, setData] = useState<any>(null);
  const [subs, setSubs] = useState<any>(null);
  
  useEffect(() => {
    fetch('/api/admin/data-recovery/preview', { headers: { 'x-user-email': 'anvantu9696@gmail.com' } }).then(res => res.json()).then(setData);
    fetch('/api/admin/data-recovery/substations', { headers: { 'x-user-email': 'anvantu9696@gmail.com' } }).then(res => res.json()).then(setSubs);
  }, []);

  const handleMap = async (legacyId: string, firestoreId: string) => {
    await fetch('/api/admin/data-recovery/map-substation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': 'anvantu9696@gmail.com' },
        body: JSON.stringify({ legacyId, firestoreId })
    });
    window.location.reload();
  };

  if (!data || !subs) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Device Relations Recovery Tool</h1>
      
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="p-4 border rounded">Total: {data.summary.total}</div>
        <div className="p-4 border rounded text-green-600">Ready: {data.summary.ready}</div>
        <div className="p-4 border rounded text-yellow-600">Unmapped Sub: {data.summary.unmappedSubstation}</div>
        <div className="p-4 border rounded text-orange-600">Unmapped Feeder: {data.summary.unmappedFeeder}</div>
        <div className="p-4 border rounded text-red-600">Invalid: {data.summary.invalid}</div>
        <div className="p-4 border rounded text-purple-600">Conflict: {data.summary.conflict}</div>
      </div>

      <h2 className="text-xl font-bold mb-2">Step 1: Substation Comparison Table</h2>
      <table className="w-full border-collapse border mb-6 text-sm">
        <thead>
          <tr>
            <th className="border p-2">Legacy ID</th>
            <th className="border p-2">Legacy Code</th>
            <th className="border p-2">Legacy Name</th>
            <th className="border p-2">Firestore Candidate ID</th>
            <th className="border p-2">Firestore Code</th>
            <th className="border p-2">Firestore Name</th>
            <th className="border p-2">Match Reason</th>
            <th className="border p-2">Feeder Evidence</th>
            <th className="border p-2">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((row: any, i: number) => (
            <tr key={i}>
              <td className="border p-2">{row.legacy.id}</td>
              <td className="border p-2">{row.legacy.code}</td>
              <td className="border p-2">{row.legacy.name}</td>
              <td className="border p-2">{row.candidate?.firestoreDocId || '-'}</td>
              <td className="border p-2">{row.candidate?.substation_code || '-'}</td>
              <td className="border p-2">{row.candidate?.name || '-'}</td>
              <td className="border p-2">{row.reason}</td>
              <td className="border p-2">{row.feederEvidence}</td>
              <td className="border p-2 font-bold">{row.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full border-collapse border">
        <thead>
          <tr>
            <th className="border p-2">Device ID</th>
            <th className="border p-2">Name</th>
            <th className="border p-2">Old Feeder</th>
            <th className="border p-2">Old Substation</th>
            <th className="border p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.preview.map((row: any, i: number) => (
            <tr key={i}>
              <td className="border p-2">{row.device_id}</td>
              <td className="border p-2">{row.device_name}</td>
              <td className="border p-2">{row.old.feeder_id}</td>
              <td className="border p-2">{row.old.substation_id}</td>
              <td className="border p-2 font-bold">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
