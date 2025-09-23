import * as tf from '@tensorflow/tfjs';

export interface OutfitScore {
  colorHarmony: number;
  styleConsistency: number;
  occasionMatch: number;
  weatherScore: number;
  wearBalance: number;
  total: number;
}

export async function trainStyleModel(
  userId: string,
  positiveExamples: number[][],
  negativeExamples: number[][]
): Promise<tf.LayersModel> {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        inputShape: [positiveExamples[0].length]
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 32, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' })
    ]
  });
  
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  // Prepare training data
  const xTrain = tf.concat([
    tf.tensor2d(positiveExamples),
    tf.tensor2d(negativeExamples)
  ]);
  
  const yTrain = tf.concat([
    tf.ones([positiveExamples.length, 1]),
    tf.zeros([negativeExamples.length, 1])
  ]);
  
  // Train the model
  await model.fit(xTrain, yTrain, {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch}: loss = ${logs?.loss.toFixed(4)}, accuracy = ${logs?.acc.toFixed(4)}`);
      }
    }
  });
  
  return model;
}

export function calculateOutfitScore(params: {
  colorHarmony: number;
  styleConsistency: number;
  occasionMatch: number;
  weatherScore: number;
  wearBalance: number;
}): OutfitScore {
  const weights = {
    colorHarmony: 0.25,
    styleConsistency: 0.25,
    occasionMatch: 0.2,
    weatherScore: 0.2,
    wearBalance: 0.1
  };
  
  const total = Object.entries(params).reduce(
    (sum, [key, value]) => sum + value * weights[key as keyof typeof weights],
    0
  );
  
  return {
    ...params,
    total
  };
}
