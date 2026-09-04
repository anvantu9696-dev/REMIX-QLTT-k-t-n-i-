const fs = require('fs');

function cleanTasks() {
    let code = fs.readFileSync('server/routes/tasks.ts', 'utf8');
    
    // Remove lines 88-91 (the extraneous catch block from fix_all.cjs)
    code = code.replace(/\}\);\n  \} catch \(err: any\) \{\n    res\.status\(500\)\.json\(\{ success: false, message: 'Lỗi' \}\);\n  \}\n\}\);\n/g, '});\n');
    
    // For route 2, 3, 4, etc. they are missing their catch blocks.
    // The destructive script replaced `});\n } catch { ... }\n});` with `});`.
    // Let's manually restore them.
    
    // route 2 /my-tasks
    code = code.replace(/res\.json\(\{ success: true, data: tasks \}\);\n\n\/\/ 3\. GET/g, "res.json({ success: true, data: tasks });\n  } catch (err: any) {\n    res.status(500).json({ success: false, message: 'Lỗi' });\n  }\n});\n\n// 3. GET");

    // route 3 /:id
    code = code.replace(/res\.json\(\{ success: true, data: \{ id: doc\.id, \.\.\.task \} \}\);\n\n\/\/ 4\. POST/g, "res.json({ success: true, data: { id: doc.id, ...task } });\n  } catch (err: any) {\n    res.status(500).json({ success: false, message: 'Lỗi' });\n  }\n});\n\n// 4. POST");

    // route 4 POST /
    code = code.replace(/res\.json\(\{ success: true, message: 'Tạo công việc thành công', data: \{ id: ref\.id, \.\.\.taskData \} \}\);\n\n\/\/ Utility/g, "res.json({ success: true, message: 'Tạo công việc thành công', data: { id: ref.id, ...taskData } });\n  } catch (err: any) {\n    res.status(500).json({ success: false, message: 'Lỗi' });\n  }\n});\n\n// Utility");

    fs.writeFileSync('server/routes/tasks.ts', code);
}

cleanTasks();
console.log('tasks cleaned');
