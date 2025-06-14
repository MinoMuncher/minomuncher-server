export async function ioAuth(username: string, password: string): Promise<string> {
    const authBody = { username, password };

    const response = await fetch('https://tetr.io/api/users/authenticate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(authBody),
    });

    if (!response.ok) {
        throw new Error(`auth request failed: ${response.status}`);
    }

    const json = (await response.json()) as object;
    if (!('token' in json)){
        throw new Error('Token not found in response');
    }

    return String(json.token);
}


export async function downloadReplay(id: string, token: string): Promise<string> {
    const url = `https://tetr.io/api/games/${id}`;
    let response: Response;

    try {
        response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
    } catch (e) {
        throw new Error("unable to reach tetr.io api")
    }

    if (!response.ok) {
        throw new Error(`request failed: ${response.status}`)
    }

    let json: any;
    try {
        json = await response.json();
    } catch {
        throw new Error("response corrupted: no json");
    }

    if (!json.success || typeof json.success !== 'boolean' || json.success !== true) {
        throw new Error("response unsuccessful");
    }

    if (!json.game || typeof json.game !== 'object') {
        throw new Error("response corrupted: no game");
    }

    return JSON.stringify(json.game);
}

export async function getUserId(username: string): Promise<string> {
    const url = `https://ch.tetr.io/api/users/${username}`;
    let response: Response;

    try {
        response = await fetch(url);
    } catch (e) {
        throw new Error("unable to reach tetr.io api")
    }

    if (!response.ok) {
        throw new Error(`request failed: ${response.status}`)
    }

    let json: any;
    try {
        json = await response.json();
    } catch (e) {
        throw new Error("response corrupted: no json");
    }

    if (!json.success || typeof json.success !== 'boolean' || json.success !== true) {
        throw new Error("response unsuccessful");
    }

    const id = json?.data?._id;
    if (typeof id !== 'string' || id.length === 0) {
        throw new Error("response corrupted: no UserID");
    }

    return id;
}
