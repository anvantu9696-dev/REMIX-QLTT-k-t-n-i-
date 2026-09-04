const fs = require('fs');
let code = fs.readFileSync('src/pages/UsersPage.tsx', 'utf8');

code = code.replace(/import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase\/firestore';/, 
`import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';`);

code = code.replace(/useEffect\(\(\) => \{\n\s*\/\/ Realtime listener[\s\S]*?const unsubscribe = onSnapshot[\s\S]*?return \(\) => unsubscribe\(\);\n\s*\}, \[\]\);/,
`const fetchUsers = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'users'));
      const list: User[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id as any,
          employee_code: data.employee_code || \`USER-\${docSnap.id.slice(0, 5)}\`,
          full_name: data.displayName || data.full_name || data.email?.split('@')[0] || 'User',
          username: data.username || data.email?.split('@')[0] || '',
          email: data.email || '',
          phone: data.phone || '',
          unit: data.unit || 'EVN',
          team: data.team || 'Đội Vận hành',
          title: data.title || 'Chuyên viên',
          status: data.status || 'PENDING',
          roles: data.roles || [data.role || 'VIEWER'],
          isActive: data.isActive ?? true,
          created_at: data.createdAt || new Date().toISOString(),
          updated_at: data.updatedAt || new Date().toISOString(),
          lastLoginAt: data.lastLoginAt
        } as any);
      });
      
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUsers(list);
    } catch (err) {
      console.error("Lỗi khi tải danh sách users", err);
      toast.error('Lỗi khi tải danh sách users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);`);

fs.writeFileSync('src/pages/UsersPage.tsx', code);
