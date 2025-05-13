// This function takes the projection matrix, the translation, and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
// The given projection matrix is also a 4x4 matrix stored as an array in column-major order.
// You can use the MatrixMult function defined in project4.html to multiply two 4x4 matrices in the same format.
function GetModelViewProjection(projectionMatrix, translationX, translationY, translationZ, rotationX, rotationY) {
	// Rotation around X
	let cosX = Math.cos(rotationX);
	let sinX = Math.sin(rotationX);
	let rotX = [
		1, 0, 0, 0,
		0, cosX, sinX, 0,
		0, -sinX, cosX, 0,
		0, 0, 0, 1
	];

	// Rotation around Y
	let cosY = Math.cos(rotationY);
	let sinY = Math.sin(rotationY);
	let rotY = [
		cosY, 0, -sinY, 0,
		0, 1, 0, 0,
		sinY, 0, cosY, 0,
		0, 0, 0, 1
	];

	// Translation
	var trans = [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		translationX, translationY, translationZ, 1
	];

	// Combine transformations
	let mv = MatrixMult(trans, MatrixMult(rotY, rotX));
	let mvp = MatrixMult(projectionMatrix, mv);
	return mvp;
}

const meshVS = `
attribute vec3 pos;
attribute vec2 texCoord;
uniform mat4 mvp;
uniform bool swapYZ;
varying vec2 vTexCoord;

void main() {
	vec3 position = pos;
	if (swapYZ)
		position = vec3(pos.x, pos.z, pos.y);
	gl_Position = mvp * vec4(position, 1.0);
	vTexCoord = texCoord;
}
`;

const meshFS = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D texture;
uniform bool showTex;

void main() {
	if (showTex)
		gl_FragColor = texture2D(texture, vTexCoord);
	else
		gl_FragColor = vec4(1.0, gl_FragCoord.z * gl_FragCoord.z, 0.0, 1.0);
}
`;

class MeshDrawer {
	constructor() {
		this.prog = InitShaderProgram(meshVS, meshFS);

		// Uniforms and attributes
		this.mvp = gl.getUniformLocation(this.prog, "mvp");
		this.swapYZ_loc = gl.getUniformLocation(this.prog, "swapYZ");
		this.showTex_loc = gl.getUniformLocation(this.prog, "showTex");
		this.sampler_loc = gl.getUniformLocation(this.prog, "texture");

		this.vertPos = gl.getAttribLocation(this.prog, "pos");
		this.texCoord = gl.getAttribLocation(this.prog, "texCoord");

		this.vertBuffer = gl.createBuffer();
		this.texBuffer = gl.createBuffer();
		this.texture = gl.createTexture();

		gl.useProgram(this.prog);
		gl.uniform1i(this.sampler_loc, 0); // Use texture unit 0
		gl.uniform1i(this.showTex_loc, true);
		gl.uniform1i(this.swapYZ_loc, false);
	}

	setMesh(vertPos, texCoords) {
		this.numVertices = vertPos.length / 3;

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
	}

	swapYZ(swap) {
		gl.useProgram(this.prog);
		gl.uniform1i(this.swapYZ_loc, swap ? 1 : 0);
	}

	draw(trans) {
		gl.useProgram(this.prog);
		gl.uniformMatrix4fv(this.mvp, false, trans);

		// Vertex positions
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
		gl.vertexAttribPointer(this.vertPos, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(this.vertPos);

		// Texture coordinates
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		gl.vertexAttribPointer(this.texCoord, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(this.texCoord);

		// Bind texture
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);

		// Draw mesh
		gl.drawArrays(gl.TRIANGLES, 0, this.numVertices);
	}

	setTexture(img) {
		gl.useProgram(this.prog);

		// Flip Y to correct upside-down textures
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		gl.generateMipmap(gl.TEXTURE_2D);
	}

	showTexture(show) {
		gl.useProgram(this.prog);
		gl.uniform1i(this.showTex_loc, show ? 1 : 0);
	}
}
