const fs = require('fs');
let indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));

const newIndexes = [
  {
    "collectionGroup": "topology_change_requests",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "loop_id", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "topology_versions",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "loop_id", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]
  }
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
