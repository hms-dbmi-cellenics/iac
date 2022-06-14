const objectHash = require('object-hash');

const DEFAULT_NA = 'N.A.';

// Generates a params hash that is really order agnostic, instead of the current one we use, which isnt
const generateGem2sParamsHash = (project, samples, experiment) => {
  if (!project || !samples || !experiment) {
    return false;
  }

  const projectSamples = Object.entries(samples).sort()
    .filter(([key, _]) => {
      return project?.samples?.includes(key);
    });
  const existingSampleIds = projectSamples.map(([_, sample]) => sample.uuid);

  // Different sample order should not change the hash.
  const orderInvariantSampleIds = [...existingSampleIds].sort();

  const hashParams = {
    organism: experiment.meta.organism,
    input: { type: experiment.meta.type },
    sampleIds: orderInvariantSampleIds,
    sampleNames: orderInvariantSampleIds.map((sampleId) => samples[sampleId].name),
  };

  if (project.metadataKeys.length) {
    hashParams.metadata = project.metadataKeys.sort().reduce((acc, key) => {
      // Make sure the key does not contain '-' as it will cause failure in GEM2S
      const sanitizedKey = key.replace(/-+/g, '_');

      acc[sanitizedKey] = projectSamples.map(
        ([, sample]) => sample.metadata[key] || DEFAULT_NA,
      );
      return acc;
    }, {});
  }

  const newHash = objectHash.sha1(hashParams, { unorderedObjects: true, unorderedArrays: true, unorderedSets: true } );

  return newHash;
};

module.exports = generateGem2sParamsHash;
