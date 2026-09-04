const fs = require('fs');

let indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));

const newIndexes = [
  // tasks
  {
    "collectionGroup": "tasks",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted_at", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "tasks",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted_at", "order": "ASCENDING" },
      { "fieldPath": "priority", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "tasks",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted_at", "order": "ASCENDING" },
      { "fieldPath": "assigned_to_username", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "tasks",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted_at", "order": "ASCENDING" },
      { "fieldPath": "created_at", "order": "DESCENDING" }
    ]
  },
  
  // users
  {
    "collectionGroup": "users",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted_at", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "users",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted_at", "order": "ASCENDING" },
      { "fieldPath": "role", "order": "ASCENDING" }
    ]
  },

  // issues
  {
    "collectionGroup": "issues",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "issues",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "severity", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "issues",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "device_id", "order": "ASCENDING" }
    ]
  },
  
  // schedules
  {
    "collectionGroup": "inspection_schedules",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted_at", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  },

  // checklists
  {
    "collectionGroup": "checklists",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "device_id", "order": "ASCENDING" }
    ]
  },
  
  // proposals
  {
    "collectionGroup": "device_proposals",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  },

  // devices
  {
    "collectionGroup": "devices",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "switch_status", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "devices",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "scada_status", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "devices",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "substation_id", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "devices",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "feeder_id", "order": "ASCENDING" },
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "substation_id", "order": "ASCENDING" }
    ]
  }
];

// Deduplicate and merge
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
console.log('done');
