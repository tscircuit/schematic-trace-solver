import scala.quoted.*

object ProcessType:

  def processType(using Quotes)(tpe: quotes.reflect.TypeRepr): quotes.reflect.TypeRepr =
    import quotes.reflect.*

    def loop(t: TypeRepr): TypeRepr =
      t match
        case AppliedType(tycon, args) =>
          AppliedType(loop(tycon), args.map(loop))

        case AndType(left, right) =>
          AndType(loop(left), loop(right))

        case OrType(left, right) =>
          OrType(loop(left), loop(right))

        case poly: PolyType =>
          PolyType(poly.paramNames)(
            _ => poly.paramTypes.map {
              case TypeBounds(low, hi) =>
                TypeBounds(loop(low), loop(hi))
            },
            _ => loop(poly.resType)
          )

        case tl: TypeLambda =>
          TypeLambda(
            tl.paramNames,
            _ => tl.paramTypes.map {
              case TypeBounds(low, hi) =>
                TypeBounds(loop(low), loop(hi))
            },
            _ => loop(tl.resType)
          )

        case mt: MatchType =>
          mt

        case rt: Refinement =>
          Refinement(loop(rt.parent), rt.name, loop(rt.info))

        case at: AnnotatedType =>
          AnnotatedType(loop(at.underlying), at.annotation)

        case ByNameType(tpe) =>
          ByNameType(loop(tpe))

        case TermRef(prefix, name) =>
          TermRef(loop(prefix), name)

        case t: TypeRef =>
          t

        case ConstantType(c) =>
          ConstantType(c)

        case _ =>
          t

    loop(tpe)

  inline def demo[A]: Unit =
    ${ demoImpl[A] }

  private def demoImpl[A: Type](using Quotes): Expr[Unit] =
    import quotes.reflect.*

    val tpe = TypeRepr.of[A]
    val processed = processType(tpe)

    println(processed.show)

    '{ () }
