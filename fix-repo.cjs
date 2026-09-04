const fs = require('fs');

function fixRepo(file) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(
        /if \(currentData\.version !== expectedVersion\) throw new Error\('VERSION_CONFLICT'\);/g,
        "if (currentData.version !== undefined && expectedVersion !== undefined && currentData.version !== expectedVersion) throw new Error('VERSION_CONFLICT');"
    );
    // also need to handle the update setting `version: currentData.version + 1`
    code = code.replace(
        /version: currentData\.version \+ 1/g,
        "version: (currentData.version || 0) + 1"
    );
    fs.writeFileSync(file, code);
}

fixRepo('server/repositories/firestore/deviceRepository.ts');
fixRepo('server/repositories/firestore/feederRepository.ts');
fixRepo('server/repositories/firestore/substationRepository.ts');
