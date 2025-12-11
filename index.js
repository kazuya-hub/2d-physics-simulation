'use strict';

(() => {
    const PIXEL_PER_WORLD_METER = 600;

    function meterToPixel(meter) {
        return meter * PIXEL_PER_WORLD_METER;
    }

    function pixelToMeter(pixel) {
        return pixel / PIXEL_PER_WORLD_METER;
    }



    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 600;
    const CIRCLE_RADIUS_IN_PIXEL = 48;

    /** @type {number} 重力加速度の大きさ */
    const G = meterToPixel(9.8);

    /** @type {number} 反発係数 (一律) */
    const COR = 0.8;

    const FPS = 60;



    class Vector {
        /**
         * @param {number} x 
         * @param {number} y 
         */
        constructor(x, y) {
            this.x = x;
            this.y = y;
        }

        /**
         * ベクトルを加算する
         * @param {Vector} vector
         */
        add(vector) {
            this.x += vector.x;
            this.y += vector.y;
        }

        /**
         * ベクトルを減算する
         * @param {Vector} vector
         */
        subtract(vector) {
            this.x -= vector.x;
            this.y -= vector.y;
        }

        /**
         * ベクトルを実数倍にする
         * @param {number} magnification 
         */
        multiply(magnification) {
            this.x *= magnification;
            this.y *= magnification;
        }

        /**
         * ベクトルの大きさを返す。
         * 距離の比較に利用する場合は、より軽量な `squaredMagnitude()` で代用可能
         */
        magnitude() {
            return Math.sqrt(this.squaredMagnitude());
        }

        /**
         * ベクトルを正規化する。
         */
        normalize() {
            const magnitude = this.magnitude();
            this.multiply(1 / magnitude);
        }

        /**
         * ベクトルの大きさの2乗を返す。
         * `magnitude()` よりも軽量。
         */
        squaredMagnitude() {
            return Math.pow(this.x, 2) + Math.pow(this.y, 2);
        }

        /**
         * ベクトルを複製した物を返す
         * @param {Vector} vector 
         */
        static copy(vector) {
            return new Vector(vector.x, vector.y);
        }

        /**
         * 2つのベクトルを加算した結果を返す
         * @param {Vector} v1 
         * @param {Vector} v2 
         */
        static added(v1, v2) {
            const tempV1 = Vector.copy(v1);
            const tempV2 = Vector.copy(v2);
            tempV1.add(tempV2);
            return tempV1;
        }

        /**
         * v1からv2を減算した結果を返す
         * @param {Vector} v1 
         * @param {Vector} v2 
         */
        static subtracted(v1, v2) {
            const tempV1 = Vector.copy(v1);
            const tempV2 = Vector.copy(v2);
            tempV1.subtract(tempV2);
            return tempV1;
        }

        /**
         * ベクトルを実数倍した結果を返す
         * @param {Vector} vector 
         * @param {number} magnification 
         */
        static multiplied(vector, magnification) {
            const tempVector = Vector.copy(vector);
            tempVector.multiply(magnification);
            return tempVector;
        }

        /**
         * ベクトルを正規化した結果を返す。
         * @param {Vector} vector
         */
        static normalized(vector) {
            const tempVector = Vector.copy(vector);
            tempVector.normalize();
            return tempVector;
        }

        /**
         * 内積を計算する
         * @param {Vector} v1 
         * @param {Vector} v2 
         */
        static innerProduct(v1, v2) {
            return v1.x * v2.x + v1.y * v2.y;
        }

        /**
         * 外積を計算する
         * @param {Vector} v1 
         * @param {Vector} v2 
         */
        static outerProduct(v1, v2) {
            return v1.x * v2.y - v1.y * v2.x;
        }

        static toString(vector) {
            return `(${vector.x}, ${vector.y})`;
        }
    }



    class World {
        constructor(canvas) {

            this.canvasManager = new CanvasManager(canvas, CANVAS_WIDTH, CANVAS_HEIGHT);

            /** @type {Array.<PhysicalObject>} */
            this.objects = [];

            this.gravity = new Vector(0, G);

            this.fps = FPS;
        }

        /**
         * 世界の時間を進める
         * @param {number} timeDelta 経過させる時間(ミリ秒)
         */
        step(timeDelta) {
            /** @type {number} 経過時間(秒) */
            const timeDeltaSeconds = timeDelta / 1000;

            /** @type {Vector} 経過時間中の重力による加速度 */
            const gravityAcceleration = Vector.multiplied(this.gravity, timeDeltaSeconds);

            this.objects.forEach(object => {
                object.accelerate(gravityAcceleration);
                // console.log(object.velocity)

                const displacement = Vector.multiplied(object.velocity, timeDeltaSeconds);
                object.move(displacement);
                // console.log(object.coord)

                // (仮実装) 画面下端との衝突
                {
                    if (object instanceof CircleObject) {

                        const circleObject = object;
                        const canvasHeight = this.canvasManager.canvasElement.height;

                        /** 円の下端のY座標 */
                        const circleBottomCoordY = circleObject.coord.y + circleObject.radius;

                        /** 画面下端に円がめり込んでいる距離 */
                        const collisionDepth = circleBottomCoordY - canvasHeight;

                        const vYBeforeCollision = circleObject.velocity.y;
                        if (
                            (collisionDepth >= 0) &&
                            (vYBeforeCollision > 0)
                        ) {
                            /** @type {number} 円が画面下端にめり込み始めた時点からの経過時間(秒) */
                            const secondsFromCollision = collisionDepth / vYBeforeCollision;
                            circleObject.velocity.y *= -0.5;

                            /** 本来移動しているべき場所までのY座標の変位 */
                            const offsetY = -collisionDepth + (circleObject.velocity.y * secondsFromCollision);
                            // console.log(circleBottomCoordY)
                            circleObject.coord.y += offsetY;
                        }
                    }
                }
            });

            // (仮実装) 衝突判定・解決
            {
                this.objects.forEach(o => { o.color = '#000000' });

                // オブジェクト2つの組み合わせを全て、被らないように列挙する
                for (let i = 0; i < this.objects.length; i++) {
                    for (let k = i + 1; k < this.objects.length; k++) {
                        const o1 = this.objects[i];
                        const o2 = this.objects[k];

                        const o1AABB = o1.getAABB();
                        if (o1AABB === null) continue;
                        const o2AABB = o2.getAABB();
                        if (o2AABB === null) continue;

                        if (AABB.isCollided(o1AABB, o2AABB) === false) continue;

                        if (
                            (o1 instanceof CircleObject) &&
                            (o2 instanceof CircleObject)
                        ) {
                            const isCollided = o1.isCollidedWithCircle(o2);
                            if (isCollided) {
                                o1.color = o2.color = '#FF0000';
                                o1.resolveCollisionWithCircle(o2);
                            }
                        }

                    }
                }
            }
        }

        /**
         * 指定したIDを持つオブジェクトをこの世界から取り除いて、取り除いたオブジェクトを返す。
         * 指定したIDを持つオブジェクトが見つからなかった場合は、nullを返す。
         * @param {number} objectId 
         * 
         * @returns {?PhysicalObject}
         */
        removeObject(objectId) {
            for (let i = 0; i < this.objects.length; i++) {
                const object = this.objects[i];
                if (object.id === objectId) {
                    console.log('removeObject', object);
                    this.objects.splice(i, 1);
                    return object;
                }
            }

            // IDが一致するオブジェクトが見つからなかった場合は、nullを返す
            return null;
        }
    }



    class PhysicalObject {

        /** 一意なオブジェクトIDを発行する */
        static issueObjectID =
            (function () {
                let idCount = 0;
                return function () { return idCount++; };
            })();

        constructor(configs) {
            this.id = PhysicalObject.issueObjectID();

            /** @type {Vector} */
            this.coord = configs.coord || new Vector(0, 0);

            /** @type {Vector} */
            this.velocity = configs.velocity || new Vector(0, 0);

            /** @type {string} */
            this.color = configs.color || '#000000';
        }

        /**
         * 
         * @param {Vector} acceleration 
         */
        accelerate(acceleration) {
            this.velocity.add(acceleration);
        }

        /**
         * 
         * @param {Vector} displacement 
         */
        move(displacement) {
            this.coord.add(displacement);
        }

        /**
         * オブジェクトのAABBを返す　定義されていない場合はnullを返す
         * @returns {?AABB}
         */
        getAABB() {
            return null;
        }
    }

    class CircleObject extends PhysicalObject {
        constructor(configs) {
            super(configs);

            this.radius = configs.radius;
            this.mass = Math.PI * Math.pow(this.radius, 2); // 密度1
        }

        getAABB() {
            const minX = this.coord.x - this.radius;
            const minY = this.coord.y - this.radius;
            const maxX = this.coord.x + this.radius;
            const maxY = this.coord.y + this.radius;
            return new AABB(minX, minY, maxX, maxY);
        }

        /**
         * CircleObjectと衝突しているか否かを返す
         * @param {CircleObject} circleObject 
         * @returns {boolean}
         */
        isCollidedWithCircle(circleObject) {

            /** @type {Vector} 自分の中心点を基準にした、相手の円の中心点の相対位置 */
            const relativeCoord = Vector.subtracted(circleObject.coord, this.coord);

            /** @type {number} 2つの円の中心点同士の直線距離を2乗したものに等しい値 */
            const squaredDistance = relativeCoord.squaredMagnitude();

            /** @type {number} 2つの円の半径の合計を2乗した値 */
            const squaredSumOfRadiuses = Math.pow((this.radius + circleObject.radius), 2);

            if (squaredDistance <= squaredSumOfRadiuses) {
                return true;
            } else {
                return false;
            }
        }

        /**
         * CircleObjectとの衝突を解決する
         * @param {CircleObject} circleObject 衝突相手のCircleObject
         */
        resolveCollisionWithCircle(circleObject) {

            // --- 衝突の解決に必要な情報を取得する処理 ---

            /** @type {Vector} 相手の中心点から見た、自分の中心点までの相対座標 */
            const relativeCoordVector = Vector.subtracted(this.coord, circleObject.coord);

            /** @type {number} 中心点同士の直線距離 */
            const distance = relativeCoordVector.magnitude();

            /**
             * @type {number} 自分の円の中で一番相手の中心に近い点と、相手の円の中で一番自分の中心に近い点との間の距離
             */
            const collisionDepth = (this.radius + circleObject.radius) - distance;

            /** @type {Vector} 反射面の単位法線ベクトル(自分の中心点を向いている) */
            const normalUnitVector = Vector.multiplied(relativeCoordVector, 1 / distance);

            // 自分の速度ベクトルの分解

            /** @type {Vector} 自分の速度ベクトルの、反射面に対する法線成分 */
            const normalComponentOfV1 =
                Vector.multiplied(
                    normalUnitVector,
                    Vector.innerProduct(this.velocity, normalUnitVector)
                );
            /** @type {Vector} 自分の速度ベクトルの、反射面に対する接線成分 */
            const tangentComponentOfV1 = Vector.subtracted(this.velocity, normalComponentOfV1);

            // 相手の速度ベクトルの分解

            /** @type {Vector} 相手の速度ベクトルの、反射面に対する法線成分 */
            const normalComponentOfV2 =
                Vector.multiplied(
                    normalUnitVector,
                    Vector.innerProduct(circleObject.velocity, normalUnitVector)
                );
            /** @type {Vector} 相手の速度ベクトルの、反射面に対する接線成分 */
            const tangentComponentOfV2 = Vector.subtracted(circleObject.velocity, normalComponentOfV2);

            // --- ここから解決の処理 ---

            // めり込みを解決する お互いにめり込んでいる長さの半分離れる
            this.move(
                Vector.multiplied(normalUnitVector, collisionDepth * 0.5)
            );
            circleObject.move(
                Vector.multiplied(normalUnitVector, collisionDepth * -0.5)
            );

            // 速度の法線成分だけを、反発係数の定義と運動量保存則から導かれる式で更新
            const newNormalComponentOfV1 = Vector.added(
                Vector.multiplied(normalComponentOfV1, (this.mass - COR * circleObject.mass) / (this.mass + circleObject.mass)),
                Vector.multiplied(normalComponentOfV2, (1 + COR) * circleObject.mass / (this.mass + circleObject.mass))
            );
            const newNormalComponentOfV2 = Vector.added(
                Vector.multiplied(normalComponentOfV1, (1 + COR) * this.mass / (this.mass + circleObject.mass)),
                Vector.multiplied(normalComponentOfV2, (circleObject.mass - COR * this.mass) / (this.mass + circleObject.mass))
            );

            this.velocity = Vector.added(tangentComponentOfV1, newNormalComponentOfV1);
            circleObject.velocity = Vector.added(tangentComponentOfV2, newNormalComponentOfV2);
        }
    }

    /**
     * x軸に平行な2つの辺とy軸に平行な2つの辺で構成され、  
     * 範囲内におけるX座標とY座標の最小値・最大値によって表現される矩形
     */
    class AABB {
        /**
         * 
         * @param {number} minX x座標の最小値 
         * @param {number} minY y座標の最小値 
         * @param {number} maxX x座標の最大値 
         * @param {number} maxY y座標の最大値 
         */
        constructor(minX, minY, maxX, maxY) {
            this.minX = minX;
            this.minY = minY;
            this.maxX = maxX;
            this.maxY = maxY;
        }

        /**
         * 2つのAABB同士が共有点を持つか否かを返す
         * @param {AABB} b1 
         * @param {AABB} b2 
         */
        static isCollided(b1, b2) {
            if (b1.maxX < b2.minX) return false;
            if (b2.maxX < b1.minX) return false;
            if (b1.maxY < b2.minY) return false;
            if (b2.maxY < b1.minY) return false;
            return true;
        }
    }



    class CanvasManager {
        /**
         * 
         * @param {HTMLCanvasElement} canvas 
         * @param {number} width
         * @param {number} height
         */
        constructor(canvas, width, height) {
            this.canvasElement = canvas;
            this.ctx = canvas.getContext('2d');

            this.setCanvasSize(width, height);
        }

        /**
         * @param {number} width
         * @param {number} height
         */
        setCanvasSize(width, height) {
            this.canvasElement.width = width;
            this.canvasElement.height = height;
        }

        clearCanvas() {
            this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        }

        canvasAABB() {
            return new AABB(0, 0, this.canvasElement.width, this.canvasElement.height);
        }
    }



    /** @type {HTMLCanvasElement} */
    const canvas = document.getElementById('canvas');

    const world = new World(canvas);

    const circleObject = new CircleObject({
        coord: new Vector(400, CIRCLE_RADIUS_IN_PIXEL),
        velocity: new Vector(0, 0),
        radius: CIRCLE_RADIUS_IN_PIXEL
    });
    world.objects.push(circleObject);

    // console.log(circleObject)



    /**
     * (仮実装) PhysicalObjectを描画する
     * @param {PhysicalObject} object 
     */
    function drawObject(object) {
        const ctx = world.canvasManager.ctx;
        ctx.strokeStyle = object.color;

        if (object instanceof CircleObject) {
            ctx.beginPath();
            ctx.arc(object.coord.x, object.coord.y, object.radius, 0, Math.PI * 2);
            ctx.stroke();
            // ctx.fill();
        }
    }

    function updateCanvas() {

        const canvasAABB = world.canvasManager.canvasAABB();

        world.canvasManager.clearCanvas();
        world.objects.forEach(o => {

            const objectAABB = o.getAABB();
            if (objectAABB === null) return;
            if (AABB.isCollided(canvasAABB, objectAABB) === false) return;

            drawObject(o);
        });
    }



    updateCanvas();

    const timeDelta = 1000 / world.fps;

    async function loopStep(timestamp) {
        // console.log(timeDelta);

        world.step(timeDelta);
        updateCanvas();

        world.objects.forEach(object => {
            // 画面から離れすぎたオブジェクトを削除する
            if (
                (Math.abs(object.coord.x) > world.canvasManager.canvasElement.width * 10) ||
                (Math.abs(object.coord.y) > world.canvasManager.canvasElement.height * 10)
            ) {
                world.removeObject(object.id);
            }

            // 画面外のオブジェクトを引き戻す
            // if (object.coord.x < 0) {
            //     object.accelerate(new Vector(3, 0));
            // }
            // if (object.coord.x > world.canvasManager.canvasElement.width) {
            //     object.accelerate(new Vector(-3, 0));
            // }
        });

        // await new Promise((resolve, reject) => { setTimeout(resolve, 100) });
        window.requestAnimationFrame(loopStep);
    }

    canvas.addEventListener('click', event => {
        // requestAnimationFrame(loopStep); return;
        const cursorCoord = new Vector(event.offsetX, event.offsetY);

        const newCircleObject = new CircleObject({
            coord: cursorCoord,
            velocity: new Vector(0, 0),
            radius: CIRCLE_RADIUS_IN_PIXEL
        });
        world.objects.push(newCircleObject);
    });

    window.requestAnimationFrame(loopStep);

    (async () => {
        // return
        // CircleObjectをランダムに出現させる
        while (true) {
            const initVX =
                (function () {
                    const speed = (Math.random() * 500 + 50);
                    const sign = ((Math.floor(Math.random() * 10) % 2) ? -1 : 1);
                    return speed * sign;
                })();
            const circleObject = new CircleObject({
                coord: new Vector(Math.random() * 800, Math.random() * 600),
                velocity: new Vector(
                    initVX,
                    Math.random() * 5000 - 2500),
                radius: CIRCLE_RADIUS_IN_PIXEL * (0.5 + Math.random())
            });
            world.objects.push(circleObject);
            await new Promise((resolve, reject) => { setInterval(resolve, 250) });
        }
    })();

})();
