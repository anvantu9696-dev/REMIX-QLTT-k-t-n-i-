const fs = require('fs');

function fixRoute(file) {
    let code = fs.readFileSync(file, 'utf8');
    // Revert my previous bad replace
    code = code.replace(
        /if \(expectedVersion === undefined\) expectedVersion = 1;/g,
        ""
    );
    // Find where expectedVersion is passed to update
    code = code.replace(
        /, expectedVersion, operationId\)/g,
        ", expectedVersion === undefined ? 1 : expectedVersion, operationId)"
    );
    // In Substations route, it might be passed as an object payload or separate args.
    // Let's check how it's passed.
    fs.writeFileSync(file, code);
}

fixRoute('server/routes/devices.ts');
fixRoute('server/routes/feeders.ts');
fixRoute('server/routes/substations.ts');
