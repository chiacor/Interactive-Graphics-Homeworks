var raytraceFS = `
struct Ray {
	vec3 pos;
	vec3 dir;
};

struct Material {
	vec3  k_d;	// diffuse coefficient
	vec3  k_s;	// specular coefficient
	float n;	// specular exponent
};

struct Sphere {
	vec3     center;
	float    radius;
	Material mtl;
};

struct Light {
	vec3 position;
	vec3 intensity;
};

struct HitInfo {
	float    t;
	vec3     position;
	vec3     normal;
	Material mtl;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;
uniform int bounceLimit;

bool IntersectRay( inout HitInfo hit, Ray ray );

// Shades the given point and returns the computed color.
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
	vec3 color = vec3(0,0,0);
	for ( int i=0; i<NUM_LIGHTS; ++i ) {
		// Check for shadows
		Ray shadowRay;
		shadowRay.pos = position + normal * 0.001; // Offset to avoid self-intersection
		shadowRay.dir = normalize(lights[i].position - position);
		
		HitInfo shadowHit;
		bool inShadow = false;
		
		// Check if there's an object between the point and the light
		if ( IntersectRay( shadowHit, shadowRay ) ) {
			float lightDistance = length(lights[i].position - position);
			if ( shadowHit.t < lightDistance ) {
				inShadow = true;
			}
		}
		
		// If not shadowed, perform shading using the Blinn model
		if ( !inShadow ) {
			vec3 lightDir = normalize(lights[i].position - position);
			vec3 halfVector = normalize(lightDir + view);
			
			// Diffuse component
			float NdotL = max(0.0, dot(normal, lightDir));
			vec3 diffuse = mtl.k_d * NdotL;
			
			// Specular component (Blinn-Phong)
			float NdotH = max(0.0, dot(normal, halfVector));
			vec3 specular = mtl.k_s * pow(NdotH, mtl.n);
			
			color += (diffuse + specular) * lights[i].intensity;
		}
	}
	return color;
}

// Intersects the given ray with all spheres in the scene
// and updates the given HitInfo using the information of the sphere
// that first intersects with the ray.
// Returns true if an intersection is found.
bool IntersectRay( inout HitInfo hit, Ray ray )
{
	hit.t = 1e30;
	bool foundHit = false;
	
	for ( int i=0; i<NUM_SPHERES; ++i ) {
		// Ray-sphere intersection using quadratic formula
		vec3 oc = ray.pos - spheres[i].center;
		float a = dot(ray.dir, ray.dir);
		float b = 2.0 * dot(oc, ray.dir);
		float c = dot(oc, oc) - spheres[i].radius * spheres[i].radius;
		
		float discriminant = b * b - 4.0 * a * c;
		
		if ( discriminant >= 0.0 ) {
			// Two potential intersection points
			float sqrtDisc = sqrt(discriminant);
			float t1 = (-b - sqrtDisc) / (2.0 * a);
			float t2 = (-b + sqrtDisc) / (2.0 * a);
			
			// Choose the nearest positive intersection
			float t = -1.0;
			if ( t1 > 0.001 && t2 > 0.001 ) {
				t = min(t1, t2);
			} else if ( t1 > 0.001 ) {
				t = t1;
			} else if ( t2 > 0.001 ) {
				t = t2;
			}
			
			// If we found a valid intersection closer than previous hits
			if ( t > 0.001 && t < hit.t ) {
				hit.t = t;
				hit.position = ray.pos + t * ray.dir;
				hit.normal = normalize(hit.position - spheres[i].center);
				hit.mtl = spheres[i].mtl;
				foundHit = true;
			}
		}
	}
	return foundHit;
}

// Given a ray, returns the shaded color where the ray intersects a sphere.
// If the ray does not hit a sphere, returns the environment color.
vec4 RayTracer( Ray ray )
{
	HitInfo hit;
	if ( IntersectRay( hit, ray ) ) {
		vec3 view = normalize( -ray.dir );
		vec3 clr = Shade( hit.mtl, hit.position, hit.normal, view );
		
		// Compute reflections
		vec3 k_s = hit.mtl.k_s;
		Ray currentRay = ray;
		HitInfo currentHit = hit;
		
		for ( int bounce=0; bounce<MAX_BOUNCES; ++bounce ) {
			if ( bounce >= bounceLimit ) break;
			if ( currentHit.mtl.k_s.r + currentHit.mtl.k_s.g + currentHit.mtl.k_s.b <= 0.0 ) break;
			
			Ray r;	// this is the reflection ray
			HitInfo h;	// reflection hit info
			
			// Initialize the reflection ray
			r.pos = currentHit.position + currentHit.normal * 0.001; // Offset to avoid self-intersection
			r.dir = reflect(currentRay.dir, currentHit.normal);
			
			if ( IntersectRay( h, r ) ) {
				// Hit found, so shade the hit point
				vec3 reflectionView = normalize(-r.dir);
				vec3 reflectionColor = Shade( h.mtl, h.position, h.normal, reflectionView );
				
				// Add the reflection contribution
				clr += k_s * reflectionColor;
				
				// Update the loop variables for tracing the next reflection ray
				k_s *= h.mtl.k_s; // Accumulate reflection coefficients
				currentRay = r;
				currentHit = h;
			} else {
				// The reflection ray did not intersect with anything,
				// so we are using the environment color
				clr += k_s * textureCube( envMap, r.dir.xzy ).rgb;
				break;	// no more reflections
			}
		}
		return vec4( clr, 1 );	// return the accumulated color, including the reflections
	} else {
		return vec4( textureCube( envMap, ray.dir.xzy ).rgb, 0 );	// return the environment color
	}
}
`;