const jobId = process.argv[2] ?? "394";
const res = await fetch(`http://127.0.0.1:3001/api/production-timer/${jobId}`);
console.log("status", res.status);
const text = await res.text();
console.log(text.slice(0, 2000));
