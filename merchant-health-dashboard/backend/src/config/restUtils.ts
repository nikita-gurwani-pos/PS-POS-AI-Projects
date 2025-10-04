import axios from "axios";


async function get(url: string, params: any) {
    const response = await axios.get(url, { params, headers: {
        'Content-Type': 'application/json',
    } });
    return response.data;
}

async function post(url: string, data: any,  params: any) {
    const response = await axios.post(url, data, { params, });
    return response.data;
}

export { get, post };