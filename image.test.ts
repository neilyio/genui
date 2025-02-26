const buffers = [/* some buffer data */];

// Create a variable "urls" that BASE64 encodes the buffers
const urls = buffers.map(buffer => `data:image/jpeg;base64,${buffer.toString('base64')}`);
