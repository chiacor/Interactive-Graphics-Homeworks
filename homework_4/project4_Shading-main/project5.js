// Global shader source
const meshVS = `
attribute vec3 pos;
attribute vec3 normal;
attribute vec2 texCoord;

uniform mat4 mvp;
uniform mat4 mv;
uniform mat3 normalMatrix;
uniform bool swapYZ;

varying vec3 vNormal;
varying vec3 vPos;
varying vec2 vTexCoord;

void main() {
    vec3 position = pos;
    vec3 norm = normal;
    if (swapYZ) {
        position = vec3(position.x, position.z, position.y);
        norm = vec3(norm.x, norm.z, norm.y);
    }
    vec4 camPos = mv * vec4(position, 1.0);
    gl_Position = mvp * vec4(position, 1.0);

    vPos = camPos.xyz;
    vNormal = normalize(normalMatrix * norm);
    vTexCoord = texCoord;
}
`;

const meshFS = `
precision mediump float;

varying vec3 vNormal;
varying vec3 vPos;
varying vec2 vTexCoord;

uniform vec3 lightDir;
uniform float shininess;
uniform bool useTexture;
uniform sampler2D tex;

void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(lightDir);
    vec3 V = normalize(-vPos);
    vec3 H = normalize(L + V);

    vec3 Kd = vec3(1.0);
    vec3 Ks = vec3(1.0);
    vec3 Ia = vec3(0.1); // Optional ambient

    if (useTexture) {
        Kd = texture2D(tex, vTexCoord).rgb;
    }

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), shininess);
    
    vec3 color = Ia + Kd * diff + Ks * spec;
    gl_FragColor = vec4(color, 1.0);
}
`;

// Create the shader program
function createMeshProgram() {
    const vs = CompileShader(gl.VERTEX_SHADER, meshVS);
    const fs = CompileShader(gl.FRAGMENT_SHADER, meshFS);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("Could not link shaders:\n" + gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function GetModelViewMatrix(tx, ty, tz, rx, ry) {
    let cosX = Math.cos(rx), sinX = Math.sin(rx);
    let cosY = Math.cos(ry), sinY = Math.sin(ry);

    let rotX = [
        1, 0,     0,    0,
        0, cosX, sinX,  0,
        0, -sinX, cosX, 0,
        0, 0,     0,    1
    ];
    let rotY = [
        cosY, 0, -sinY, 0,
        0,    1, 0,     0,
        sinY, 0, cosY,  0,
        0,    0, 0,     1
    ];
    let trans = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        tx, ty, tz, 1
    ];

    return MatrixMult(trans, MatrixMult(rotY, rotX));
}

class MeshDrawer {
    constructor() {
        this.prog = createMeshProgram();

        this.aPos = gl.getAttribLocation(this.prog, 'pos');
        this.aNormal = gl.getAttribLocation(this.prog, 'normal');
        this.aTexCoord = gl.getAttribLocation(this.prog, 'texCoord');

        this.uMVP = gl.getUniformLocation(this.prog, 'mvp');
        this.uMV = gl.getUniformLocation(this.prog, 'mv');
        this.uNormalMatrix = gl.getUniformLocation(this.prog, 'normalMatrix');
        this.uSwapYZ = gl.getUniformLocation(this.prog, 'swapYZ');
        this.uUseTexture = gl.getUniformLocation(this.prog, 'useTexture');
        this.uTex = gl.getUniformLocation(this.prog, 'tex');
        this.uLightDir = gl.getUniformLocation(this.prog, 'lightDir');
        this.uShininess = gl.getUniformLocation(this.prog, 'shininess');

        this.vertexBuffer = gl.createBuffer();
        this.texCoordBuffer = gl.createBuffer();
        this.normalBuffer = gl.createBuffer();

        this.texture = gl.createTexture();
        this.hasTexture = false;
        this.useTex = false;
        this.numTriangles = 0;
    }

    setMesh(vertPos, texCoords, normals) {
        this.numTriangles = vertPos.length / 3;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    }

    swapYZ(swap) {
        gl.useProgram(this.prog);
        gl.uniform1i(this.uSwapYZ, swap);
    }

    draw(mvp, mv, normalMatrix) {
        gl.useProgram(this.prog);

        // Set uniforms
        gl.uniformMatrix4fv(this.uMVP, false, mvp);
        gl.uniformMatrix4fv(this.uMV, false, mv);
        gl.uniformMatrix3fv(this.uNormalMatrix, false, normalMatrix);
        gl.uniform1i(this.uUseTexture, this.useTex && this.hasTexture);

        // Attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aPos);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aTexCoord);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aNormal);

        // Texture
        if (this.useTex && this.hasTexture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(this.uTex, 0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, this.numTriangles);
    }

    setTexture(img) {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        this.hasTexture = true;
    }

    showTexture(show) {
        this.useTex = show;
    }

    setLightDir(x, y, z) {
        gl.useProgram(this.prog);
        gl.uniform3f(this.uLightDir, x, y, z);
    }

    setShininess(shininess) {
        gl.useProgram(this.prog);
        gl.uniform1f(this.uShininess, shininess);
    }
}
