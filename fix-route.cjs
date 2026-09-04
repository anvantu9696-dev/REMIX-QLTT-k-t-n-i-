const fs = require('fs');

function fixRoute(file) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(
        /if \(expectedVersion === undefined\) return res\.status\(400\)\.json\(\{ success: false, code: 'EXPECTED_VERSION_REQUIRED' \}\);/g,
        "if (expectedVersion === undefined) expectedVersion = 1;"
    );
    fs.writeFileSync(file, code);
}

fixRoute('server/routes/devices.ts');
fixRoute('server/routes/feeders.ts');
fixRoute('server/routes/substations.ts');
