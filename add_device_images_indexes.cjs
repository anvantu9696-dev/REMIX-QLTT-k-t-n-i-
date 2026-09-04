const fs = require('fs');
let indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));

const newIndexes = [
  {
    "collectionGroup": "device_images",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "device_id", "order": "ASCENDING" },
      { "fieldPath": "isPrimary", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "device_images",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "device_id", "order": "ASCENDING" },
      { "fieldPath": "isDeleted", "order": "ASCENDING" }
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
