const fs = require('fs');
let indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));

const newIndexes = [
  // tasks
  { "collectionGroup": "tasks", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "tasks", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "tasks", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "priority", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "tasks", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "assigned_to_username", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },
  
  // issues
  { "collectionGroup": "issues", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "isDeleted", "order": "ASCENDING" }, { "fieldPath": "reported_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "issues", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "isDeleted", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "reported_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "issues", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "isDeleted", "order": "ASCENDING" }, { "fieldPath": "severity", "order": "ASCENDING" }, { "fieldPath": "reported_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "issues", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "isDeleted", "order": "ASCENDING" }, { "fieldPath": "device_id", "order": "ASCENDING" }, { "fieldPath": "reported_at", "order": "DESCENDING" } ] },

  // schedules
  { "collectionGroup": "inspection_schedules", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "inspection_schedules", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "device_id", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "inspection_schedules", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "target_type", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },

  // proposals
  { "collectionGroup": "proposals", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "proposals", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "proposals", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "type", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] },
  { "collectionGroup": "proposals", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "deleted_at", "order": "ASCENDING" }, { "fieldPath": "created_by", "order": "ASCENDING" }, { "fieldPath": "created_at", "order": "DESCENDING" } ] }
];

const allIndexes = [...indexes.indexes];
for (const ni of newIndexes) {
    const exists = allIndexes.find(i => 
        i.collectionGroup === ni.collectionGroup &&
        JSON.stringify(i.fields) === JSON.stringify(ni.fields)
    );
    if (!exists) {
        allIndexes.push(ni);
    }
}
indexes.indexes = allIndexes;
fs.writeFileSync('firestore.indexes.json', JSON.stringify(indexes, null, 2));
