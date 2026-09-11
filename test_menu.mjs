import axios from 'axios';

async function test() {
    try {
        const res = await axios.post('http://127.0.0.1:8000/api/auth/login', {
            username: 'admin',
            password: 'password' // or whatever default password
        });
        const token = res.data.token;
        console.log('Token:', token);

        // Try adding menu item
        const formData = new FormData();
        formData.append('name', 'Test Item');
        formData.append('category', 'All');
        formData.append('price', '10.00');
        formData.append('description', 'Test desc');
        formData.append('available', 1);

        const res2 = await axios.post('http://127.0.0.1:8000/api/menu-items', formData, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Success:', res2.data);
    } catch (e) {
        console.log('Error:', e.response?.status);
        console.log('Data:', e.response?.data);
    }
}
test();
