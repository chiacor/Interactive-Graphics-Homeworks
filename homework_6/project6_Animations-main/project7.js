// Global shader source (needed for the simulation to display properly)
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

// Create the shader program (needed for rendering)
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

// Transformation matrix function
function GetModelViewMatrix(translationX, translationY, translationZ, rotationX, rotationY) {
    let cosX = Math.cos(rotationX), sinX = Math.sin(rotationX);
    let cosY = Math.cos(rotationY), sinY = Math.sin(rotationY);

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
        translationX, translationY, translationZ, 1
    ];

    return MatrixMult(trans, MatrixMult(rotY, rotX));
}

// Complete MeshDrawer class (needed for rendering)
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
    
    draw(matrixMVP, matrixMV, matrixNormal) {
        gl.useProgram(this.prog);

        // Set uniforms
        gl.uniformMatrix4fv(this.uMVP, false, matrixMVP);
        gl.uniformMatrix4fv(this.uMV, false, matrixMV);
        gl.uniformMatrix3fv(this.uNormalMatrix, false, matrixNormal);
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

// The simulation function
function SimTimeStep( dt, positions, velocities, springs, stiffness, damping, particleMass, gravity, restitution )
{
	var forces = Array( positions.length ); // The total for per particle

	// Compute the total force of each particle
	// Initialize
	for(var i = 0; i < positions.length; i+=1){
		forces[i] = new Vec3(0,0,0);
	}
	// Add Gravity
	for(var i = 0; i < positions.length; i+=1){
		forces[i].inc(gravity.mul(particleMass));
	}
	// Mass-spring
	for(var s = 0; s < springs.length; s+=1){
		var i = positions[springs[s].p0];
		var j = positions[springs[s].p1];
		//spring force
		var l = j.sub(i).len();
		var d = j.sub(i).div(l);
		var Fs = d.mul(stiffness * (l - springs[s].rest));
		
		//damping force
		diffinV = velocities[springs[s].p1].sub(velocities[springs[s].p0]);
		var ldot = d.dot(diffinV);
		var Fd = d.mul(damping * ldot);
		//update foreces
		forces[springs[s].p0].inc(Fs.add(Fd));
		forces[springs[s].p1].dec(Fs.add(Fd));
	}
	// Update positions and velocities
	for (var i = 0; i < positions.length; i+=1){
		var a = forces[i].div(particleMass);
		var vt = velocities[i].add(a.mul(dt));
		var xt = positions[i].add(vt.mul(dt));
		velocities[i].set(vt);
		positions[i].set(xt);
	}
	// Handle collisions
	for (var i = 0; i < positions.length; i+=1){
		// change xyz of position and velocity if any collisions occur in that axis
		// if not, they will remain unchanged
		var posCopy = positions[i].copy();
		var velocityCopy = velocities[i].copy();
		var pos_x = posCopy.x;
		var pos_y = posCopy.y;
		var pos_z = posCopy.z;

		var vel_x = velocityCopy.x;
		var vel_y = velocityCopy.y;
		var vel_z = velocityCopy.z;
		
		// check collision in y direction
		if (positions[i].y < -1 || positions[i].y > 1){
			var y0;
			if(positions[i].y < -1)
				y0 = -1;
			else if (positions[i].y > 1){
				y0 = 1;
			}
			var h = Math.abs(positions[i].y - y0);
			var h2 = restitution * h;
			
			vel_y = velocities[i].y * -restitution;
			pos_y = -1 + h2;

		
		}
		// check collision in x direction
		if (positions[i].x < -1 || positions[i].x > 1){
			var x0;
			if(positions[i].x < -1)
				x0 = -1;
			else if (positions[i].x > 1){
				x0 = 1;
			}

			var h_x = Math.abs(positions[i].x  - x0);
			var h_x2 = restitution * h_x;

			vel_x = velocities[i].x * -restitution;
			pos_x = x0 + h_x2;			
		}
		// check collision in z direction
		if (positions[i].z < -1 || positions[i].z > 1){
			var z0;
			if(positions[i].z < -1)
				z0 = -1;
			else if (positions[i].z > 1){
				z0 = 1;
			}

			var h_z = Math.abs(positions[i].z  - z0);
			var h_z2 = restitution * h_z;

			vel_z = velocities[i].z * -restitution;
			pos_z = z0 + h_z2;			
		}
		// update position and velocity
		positions[i].set(new Vec3(pos_x, pos_y, pos_z));
		velocities[i].set(new Vec3(vel_x, vel_y, vel_z));
	}

}