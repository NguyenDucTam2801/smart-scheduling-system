//using for clause of locking
export function setClauses(data: any) {
    const setClauses: string[] = [
        `version = version + 1`,
        `updated_at = now()`,
    ];
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const value = data[key];

            if (value !== undefined && value !== null && (typeof (value) === "number" || typeof (value) === "string")) {
                setClauses.push(`${key} = '${value}'`);
            }
        }
    }
    return setClauses.join(", ")
}