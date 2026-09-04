const fs = require('fs');

let code = fs.readFileSync('server/routes/issues.ts', 'utf8');

// Replace everything from `res.json({ success: true, data: issues, nextCursor:` ... down to the start of `// 2. GET /api/issues/:id`
code = code.replace(
  /res\.json\(\{ success: true, data: issues, nextCursor: hasMore \? issues\[issues\.length - 1\]\.id : undefined \}\);[\s\S]*?\/\/ 2\. GET \/api\/issues\/:id/,
  `res.json({ success: true, data: issues, nextCursor: hasMore ? issues[issues.length - 1].id : undefined });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. GET /api/issues/:id`
);

// Also issues.ts lines 96-99 are extraneous catch blocks after `// 2. GET`
code = code.replace(
  /res\.json\(\{ success: true, data: \{ id: doc\.id, \.\.\.doc\.data\(\) \} \}\);\n  \} catch \(error: any\) \{\n    res\.status\(500\)\.json\(\{ success: false, message: 'Lỗi hệ thống khi lấy chi tiết bất thường' \}\);\n  \}\n\}\);\n  \} catch \(err: any\) \{\n    res\.status\(500\)\.json\(\{ success: false, message: 'Lỗi hệ thống' \}\);\n  \}\n\}\);/g,
  `res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy chi tiết bất thường' });
  }
});`
);

fs.writeFileSync('server/routes/issues.ts', code);
